const { getChannel } = require("../config/rabbitmq");
const Campaign = require("../models/campaign.model");
const connectCustomerDB = require("../config/customerDb");
const customerSchema = require("../models/customer.model").schema;

module.exports = function startCampaignProcessConsumer() {
  const channel = getChannel();

  channel.assertQueue("campaign_process", { durable: true });
  channel.assertQueue("campaign_delivery", { durable: true });

  channel.consume("campaign_process", async (msg) => {
    try {
      const { campaignId } = JSON.parse(msg.content.toString());
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

      const customerDb = await connectCustomerDB();
      const Customer = customerDb.models.Customer || customerDb.model("Customer", customerSchema);

      // just get the actual audience (count is already stored in campaign)
      const audience = await Customer.find(buildFilterFromRules(campaign.rules, campaign.ownerId));

      console.log(
        `Enqueuing ${audience.length} customers for Campaign ${campaignId}`
      );

      const BATCH_SIZE = 100;
      for (let i = 0; i < audience.length; i += BATCH_SIZE) {
        const batch = audience.slice(i, i + BATCH_SIZE);
        batch.forEach((customer) => {
          channel.sendToQueue(
            "campaign_delivery",
            Buffer.from(
              JSON.stringify({ campaignId, customerId: customer._id, ownerId: campaign.ownerId })
            ),
            { persistent: true }
          );
        });
      }

      channel.ack(msg);
    } catch (err) {
      console.error("Error in campaignProcess.consumer:", err);
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
