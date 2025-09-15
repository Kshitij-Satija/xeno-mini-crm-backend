const { getChannel } = require("../config/rabbitmq");
const Customer = require("../models/customer.model");

const startCustomerDeleteConsumer = async () => {
  const channel = getChannel();
  await channel.assertQueue("customerDeleteQueue", { durable: true });

  channel.consume("customerDeleteQueue", async (msg) => {
    if (!msg) return;
    try {
      const { ownerId, customerId } = JSON.parse(msg.content.toString());
      await Customer.deleteOne({ ownerId, customerId });
      channel.ack(msg);
      //console.log(`Customer ${customerId} deleted for owner ${ownerId}`);
    } catch (err) {
      console.error("Error deleting customer:", err.message);
      channel.nack(msg, false, false);
    }
  });
};
module.exports = startCustomerDeleteConsumer;
