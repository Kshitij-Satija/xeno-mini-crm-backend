const { getChannel } = require("../config/rabbitmq");
const Campaign = require("../models/campaign.model");
const CommunicationLog = require("../models/communicationLog.model");
const connectCustomerDB = require("../config/customerDb");
const customerSchema = require("../models/customer.model").schema;
const axios = require("axios");

module.exports = function startCampaignDeliveryConsumer() {
  const channel = getChannel();

  channel.assertQueue("campaign_delivery", { durable: true });

  channel.consume("campaign_delivery", async (msg) => {
    try {
      const { campaignId, customerId, ownerId } = JSON.parse(msg.content.toString());

      const customerDb = await connectCustomerDB();
      const Customer =
        customerDb.models.Customer || customerDb.model("Customer", customerSchema);
      const customer = await Customer.findById(customerId);
      if (!customer) throw new Error(`Customer not found: ${customerId}`);

      const campaign = await Campaign.findById(campaignId);
      if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

      const personalizedMessage = `Hi ${customer.name}, ${campaign.message}`;

      const commLog = await CommunicationLog.create({
        campaignId,
        ownerId,
        customerId,
        customerNumericId: customer.customerId,
        message: personalizedMessage,
        status: "PENDING",
      });

      // Call Vendor API (it will simulate success/failure and send a receipt back)
      await axios.post(`${process.env.VENDOR_API_URI}/send`, {
        campaignId,
        customerId,
        ownerId,
        commLogId: commLog._id,
        message: personalizedMessage,
      });

      channel.ack(msg);
      console.log(`Sent to Vendor API for customer ${customerId}`);
    } catch (err) {
      console.error("Error in campaignDelivery.consumer:", err);
      channel.nack(msg, false, false);
    }
  });
};
