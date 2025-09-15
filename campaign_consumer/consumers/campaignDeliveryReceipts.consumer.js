const { getChannel } = require("../config/rabbitmq");
const Campaign = require("../models/campaign.model");
const CommunicationLog = require("../models/communicationLog.model");

module.exports = function startDeliveryReceiptsConsumer() {
  const channel = getChannel();

  channel.assertQueue("delivery_receipts", { durable: true });

  const BATCH_SIZE = 100;
  let batchQueue = [];

  async function processBatch() {
    if (!batchQueue.length) return;

    const batch = [...batchQueue];
    batchQueue = [];

    const bulkOps = batch.map(({ vendorMessageId, campaignId, status }) => ({
      updateOne: {
        filter: { _id: vendorMessageId.replace(/^v_/, "") }, // strip vendor prefix → commLogId
        update: {
          status,
          lastUpdatedAt: new Date(),
        },
      },
    }));

    const sentCount = batch.filter((b) => b.status === "SENT").length;
    const failedCount = batch.filter((b) => b.status === "FAILED").length;

    // update comm logs
    await CommunicationLog.bulkWrite(bulkOps);

    if (batch[0]?.campaignId) {
      const campaignId = batch[0].campaignId;

      // update stats
      const campaign = await Campaign.findByIdAndUpdate(
        campaignId,
        {
          $inc: {
            "stats.sent": sentCount,
            "stats.failed": failedCount,
          },
        },
        { new: true }
      );

      if (campaign) {
        const { sent, failed, audienceSize } = campaign.stats;

        if (campaign.status !== "COMPLETED" && sent + failed >= audienceSize) {
          await Campaign.findByIdAndUpdate(campaignId, { status: "COMPLETED" });
          console.log(`Campaign ${campaignId} marked COMPLETED`);
        }
      }
    }

    console.log(`Delivery receipts processed: ${sentCount} SENT, ${failedCount} FAILED`);
  }

  channel.consume("delivery_receipts", async (msg) => {
    try {
      const { vendorMessageId, campaignId, customerId, status } = JSON.parse(msg.content.toString());

      batchQueue.push({ vendorMessageId, campaignId, status });

      if (batchQueue.length >= BATCH_SIZE) {
        await processBatch();
      }

      channel.ack(msg);
      console.log(`Receipt queued for ${customerId}: ${status}`);
    } catch (err) {
      console.error("Error in deliveryReceipts.consumer:", err);
      channel.nack(msg, false, false);
    }
  });

  setInterval(() => {
    processBatch().catch((err) => console.error("Batch processing error:", err));
  }, 5000);
};
