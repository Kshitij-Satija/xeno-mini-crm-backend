const { getChannel } = require("../config/rabbitmq");
const Campaign = require("../models/campaign.model");
const connectCustomerDB = require("../config/customerDb");
const customerSchema = require("../models/customer.model").schema;
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

module.exports = function startCampaignCreateConsumer() {
  const channel = getChannel();

  channel.assertQueue("campaign_created", { durable: true });
  channel.assertQueue("campaign_process", { durable: true });

  channel.consume("campaign_created", async (msg) => {
    try {
      const { campaignId } = JSON.parse(msg.content.toString());
      console.log("[CAMPAIGN_CREATED] Received campaign:", campaignId);

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

      if (["PROCESSING", "COMPLETED"].includes(campaign.status)) {
        console.log(`Campaign ${campaignId} already ${campaign.status}, skipping.`);
        return channel.ack(msg);
      }

      // 🔑 calculate audience size & avg spend
      const customerDb = await connectCustomerDB();
      const Customer =
        customerDb.models.Customer ||
        customerDb.model("Customer", customerSchema);

      const filter = buildFilterFromRules(campaign.rules, campaign.ownerId);

      const audienceSize = await Customer.countDocuments(filter);

      const agg = await Customer.aggregate([
        { $match: filter },
        { $group: { _id: null, avgSpend: { $avg: "$totalSpend" } } },
      ]);
      const avgSpend = agg[0]?.avgSpend || 0;

      // auto-tagging campaign
      let tags = [];
      try {
        const systemPrompt = `
          You are a CRM marketing assistant. Based on the campaign details,
          generate up to 3 short tags (each ≤ 3 words) that summarize the campaign intent.

          - Consider the campaign message, targeting rules, audience size, and avg spend.
          - Tags should help marketers quickly understand the campaign’s purpose.
          - Return only a comma-separated list (no explanations, no extra text).

          Examples of good tags:
          "High Value Customers", "Discount Campaign", "Seasonal Promo", "VIP Outreach".
        `;

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              role: "user",
              text: `${systemPrompt}

Campaign message: ${campaign.message}
Targeting rules: ${JSON.stringify(campaign.rules)}
Audience size: ${audienceSize}
Average spend: ₹${avgSpend.toFixed(2)}
`,
            },
          ],
        });

        //console.log("Raw Gemini response:", JSON.stringify(response, null, 2));

        const raw =
          response?.candidates?.[0]?.content?.parts?.[0]?.text ||
          response?.candidates?.[0]?.output_text ||
          "";

        tags = raw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      } catch (err) {
        console.error("AI tagging failed:", err.message);
      }

      // update stats, tags, and mark PROCESSING
      campaign.stats.audienceSize = audienceSize;
      campaign.tags = tags;
      campaign.status = "PROCESSING";
      await campaign.save();

      // enqueue processing step
      channel.sendToQueue(
        "campaign_process",
        Buffer.from(JSON.stringify({ campaignId })),
        { persistent: true }
      );

      //console.log(`Campaign ${campaignId} moved to processing | audienceSize=${audienceSize} | avgSpend=₹${avgSpend.toFixed(2)} | tags=${tags.join(", ") || "none"}`);
      channel.ack(msg);
    } catch (err) {
      console.error("Error in campaignCreate.consumer:", err);
      channel.nack(msg, false, false);
    }
  });
};

function buildFilterFromRules(rules, ownerId) {
  let mongoFilter = { ownerId };
  if (!rules?.rules?.length) return mongoFilter;

  const subFilters = rules.rules.map((r) => {
    switch (r.operator) {
      case ">":
        return { [r.field]: { $gt: r.value } };
      case ">=":
        return { [r.field]: { $gte: r.value } };
      case "<":
        return { [r.field]: { $lt: r.value } };
      case "<=":
        return { [r.field]: { $lte: r.value } };
      case "=":
      case "==":
        return { [r.field]: r.value };
      case "!=":
        return { [r.field]: { $ne: r.value } };
      default:
        return {};
    }
  });

  if (rules.logic === "OR") mongoFilter.$or = subFilters;
  else Object.assign(mongoFilter, ...subFilters);

  return mongoFilter;
}
