const { getChannel } = require("../config/rabbitmq");
const Customer = require("../models/customer.model");

const startCustomerUpdateConsumer = async () => {
  const channel = getChannel();
  await channel.assertQueue("customerUpdateQueue", { durable: true });

  channel.consume("customerUpdateQueue", async (msg) => {
    if (!msg) return;
    try {
      const { ownerId, customerId, updates } = JSON.parse(msg.content.toString());
      await Customer.updateOne({ ownerId, customerId }, { $set: updates });
      channel.ack(msg);
      //console.log(`Customer ${customerId} updated for owner ${ownerId}`);
    } catch (err) {
      console.error("Error updating customer:", err.message);
      channel.nack(msg, false, false);
    }
  });
};
module.exports = startCustomerUpdateConsumer;
