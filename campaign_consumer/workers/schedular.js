const Campaign = require("../models/campaign.model");
const { getChannel } = require("../config/rabbitmq");

module.exports = function startScheduler() {
  const channel = getChannel();

  setInterval(async () => {
    try {
      const now = new Date();

      const campaigns = await Campaign.find({
        status: "SCHEDULED",
        scheduledAt: { $lte: now },
      });

      for (const campaign of campaigns) {
        console.log(`Enqueuing scheduled campaign ${campaign._id}`);

        channel.sendToQueue(
          "campaign_created",
          Buffer.from(JSON.stringify({ campaignId: campaign._id })),
          { persistent: true }
        );

        // mark as PENDING so the consumer can pick it
        await Campaign.findByIdAndUpdate(campaign._id, { status: "PENDING" });

        console.log(`Campaign ${campaign._id} status updated to PENDING`);
      }
    } catch (err) {
      console.error("Scheduler error:", err);
    }
  }, 60 * 1000); // runs every 1 min
};
