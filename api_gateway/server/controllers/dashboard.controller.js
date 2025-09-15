const axios = require("axios");

exports.getOverviewStats = async (req, res) => {
  try {
    const ownerId = req.user._id.toString();
    console.log("Dashboard request for ownerId:", ownerId);

    // Fetch both services in parallel
    const [customerServiceRes, campaignOverviewRes] = await Promise.all([
      axios.get(`${process.env.CUSTOMER_SERVICE_URI}/custorder/overview`, { params: { ownerId } }),
      axios.get(`${process.env.CAMPAIGN_SERVICE_URI}/campaigns/overview`, { params: { ownerId } }),
    ]);

    const campaignData = campaignOverviewRes.data || {};
    const customerData = customerServiceRes.data || {};

    res.json({
      // Campaign stats
      campaigns: campaignData.count || 0,
      messagesSent: campaignData.messagesSent || 0,
      messagesFailed: campaignData.messagesFailed || 0,
      messagesPending: campaignData.messagesPending || 0,
      totalAudience: campaignData.totalAudience || 0,
      statusSummary: campaignData.statusSummary || { PENDING: 0, SCHEDULED: 0, PROCESSING: 0, COMPLETED: 0 },
      recentCampaigns: Array.isArray(campaignData.recentCampaigns) ? campaignData.recentCampaigns : [],
      recentMessages: Array.isArray(campaignData.recentMessages) ? campaignData.recentMessages : [],

      // Customer stats
      customers: customerData.totalCustomers || 0,
      totalOrders: customerData.totalOrders || 0,
      totalLifetimeSpend: customerData.totalLifetimeSpend || 0,
      totalRevenue: customerData.totalRevenue || 0,
      genderDistribution: customerData.genderDistribution || {},
      ageDistribution: customerData.ageDistribution || {},
      recentCustomers: Array.isArray(customerData.recentCustomers) ? customerData.recentCustomers : [],
      ordersByStatus: customerData.ordersByStatus || {},
      recentOrders: Array.isArray(customerData.recentOrders) ? customerData.recentOrders : [],
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
};
