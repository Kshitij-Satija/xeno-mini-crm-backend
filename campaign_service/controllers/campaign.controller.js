const mongoose = require("mongoose");

const Campaign = require("../models/campaign.model");
const { getChannel } = require("../config/rabbitmq");
const axios = require("axios");
const CommunicationLog = require("../models/communicationLog.model");

// Previewing
exports.previewAudience = async (req, res, next) => {
  try {
    const ownerId = req.headers["x-user-id"];
    const rules = req.body.rules;
    if (!rules) return res.status(400).json({ message: "rules required" });

    //console.log("previewAudience called with ownerId:", ownerId, "rules:", JSON.stringify(rules));

    const resp = await axios.post(
      `${process.env.CUSTOMER_SERVICE_URI}/customers/query-count`,
      { rules },
      { headers: { "x-owner-id": ownerId } }
    );

    //console.log("Customer Service response:", resp.data);

    return res.json({ audienceSize: resp.data.count || 0 });
  } catch (err) {
    console.error("previewAudience ERROR:", err.response?.data || err.message);
    return res.status(500).json({ message: "Failed to preview audience" });
  }
};


// controllers/campaign.controller.js
exports.createCampaign = async (req, res, next) => {
  try {
    const ownerId = req.headers["x-user-id"];
    const { campaignName, rules, message, scheduledAt, deliveryMode } = req.body;

    if (!rules || !message) {
      return res.status(400).json({ message: "rules and message required" });
    }

    const isScheduled =
      deliveryMode === "SCHEDULED" &&
      scheduledAt &&
      new Date(scheduledAt) > new Date();

    const status = isScheduled ? "SCHEDULED" : "PENDING";

    const campaign = await Campaign.create({
      ownerId,
      campaignName: campaignName || null, 
      rules,
      message,
      deliveryMode,
      scheduledAt: scheduledAt || null,
      status,
    });

    const channel = getChannel();
    await channel.assertQueue("campaign_created", { durable: true });

    // Enqueue only if immediate delivery
    if (!isScheduled) {
      channel.sendToQueue(
        "campaign_created",
        Buffer.from(JSON.stringify({ campaignId: campaign._id })),
        { persistent: true }
      );
    }

    return res
      .status(202)
      .json({ message: "Campaign created", campaignId: campaign._id });
  } catch (err) {
    next(err);
  }
};


exports.deliveryReceipt = async (req, res, next) => {
  try {
    // expected: { vendorMessageId, campaignId, customerId, status: "SENT"|"FAILED", timestamp? }
    const receipt = req.body;
    if (!receipt || !receipt.vendorMessageId || !receipt.campaignId) {
      return res.status(400).json({ message: "Invalid receipt payload" });
    }

    const channel = getChannel();
    await channel.assertQueue("delivery_receipts", { durable: true });
    channel.sendToQueue("delivery_receipts", Buffer.from(JSON.stringify(receipt)), { persistent: true });

    return res.status(200).json({ message: "Receipt queued" });
  } catch (err) {
    next(err);
  }
};

exports.listCampaigns = async (req, res, next) => {
  try {
    const ownerId = req.headers["x-user-id"];
    if (!ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: "Invalid or missing x-user-id header" });
    }

    const campaigns = await Campaign.find({ ownerId }).sort({ createdAt: -1 });

    // inject placeholder if no tags yet, so that there is something to display on frontend
    const campaignsWithTags = campaigns.map((c) => ({
      ...c.toObject(),
      tags: c.tags?.length ? c.tags : ["Processing tags..."],
    }));

    return res.json({ campaigns: campaignsWithTags });
  } catch (err) {
    next(err);
  }
};


exports.getCampaign = async (req, res, next) => {
  try {
    const ownerId = req.headers["x-user-id"];
    const { id } = req.params;
    if (!ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: "Invalid or missing x-user-id header" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid campaign id" });
    }

    const campaign = await Campaign.findOne({ _id: id, ownerId });
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    return res.json({ campaign });
  } catch (err) {
    next(err);
  }
};


exports.getCampaignOverview = async (req, res) => {
  try {
    const ownerId = req.user?._id || req.query.ownerId;
    if (!ownerId) return res.status(400).json({ message: "ownerId missing" });

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    // Total campaigns
    const campaignCount = await Campaign.countDocuments({ ownerId: ownerObjectId });

    // Messages summary (owner-level)
    const messagesAgg = await CommunicationLog.aggregate([
      { $match: { ownerId: ownerObjectId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const messagesSummary = messagesAgg.reduce(
      (acc, m) => {
        if (m._id === "SENT") acc.sent = m.count;
        if (m._id === "FAILED") acc.failed = m.count;
        if (m._id === "PENDING") acc.pending = m.count;
        return acc;
      },
      { sent: 0, failed: 0, pending: 0 }
    );

    const totalAudience = messagesSummary.sent + messagesSummary.failed + messagesSummary.pending;

    // Campaign status counts
    const statusCounts = await Campaign.aggregate([
      { $match: { ownerId: ownerObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statusSummary = statusCounts.reduce(
      (acc, s) => {
        acc[s._id] = s.count;
        return acc;
      },
      { PENDING: 0, SCHEDULED: 0, PROCESSING: 0, COMPLETED: 0 }
    );

    // Recent campaigns with live message stats
    const recentCampaignsRaw = await Campaign.find({ ownerId: ownerObjectId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("campaignName status createdAt");

    // Fetch message stats per campaign
    const messagesPerCampaign = await CommunicationLog.aggregate([
      { $match: { ownerId: ownerObjectId } },
      {
        $group: {
          _id: "$campaignId",
          sent: { $sum: { $cond: [{ $eq: ["$status", "SENT"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
        },
      },
    ]);

    // Map campaignId -> stats
    const campaignStatsMap = messagesPerCampaign.reduce((acc, m) => {
      acc[m._id.toString()] = { sent: m.sent, failed: m.failed, pending: m.pending };
      return acc;
    }, {});

    const recentCampaigns = recentCampaignsRaw.map((c) => {
      const stats = campaignStatsMap[c._id.toString()] || { sent: 0, failed: 0, pending: 0 };
      return {
        _id: c._id,
        campaignName: c.campaignName,
        status: c.status,
        createdAt: c.createdAt,
        messages: stats,
      };
    });

    // Recent messages preview
    const recentMessages = await CommunicationLog.find({ ownerId: ownerObjectId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("campaignId customerId message status createdAt");

    res.json({
      count: campaignCount,
      messagesSent: messagesSummary.sent,
      messagesFailed: messagesSummary.failed,
      messagesPending: messagesSummary.pending,
      totalAudience,
      statusSummary,
      recentCampaigns,
      recentMessages,
    });
  } catch (err) {
    console.error("/campaigns/overview error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
