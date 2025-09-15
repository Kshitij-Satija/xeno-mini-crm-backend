const { getChannel } = require("../config/rabbitmq");
const Order = require("../models/order.model");
const mongoose = require("mongoose");

const startOrderDeleteConsumer = async () => {
  const channel = getChannel();
  await channel.assertQueue("orderDeleteQueue", { durable: true });

  channel.consume("orderDeleteQueue", async (msg) => {
    if (!msg) return;
    try {
      const { ownerId, orderId } = JSON.parse(msg.content.toString());
      if (!ownerId || !orderId) throw new Error("Missing ownerId or orderId");

      let query = { ownerId: new mongoose.Types.ObjectId(ownerId) };
      if (orderId.match && orderId.match(/^[0-9a-fA-F]{24}$/)) {
        query._id = orderId;
      } else {
        query.orderId = isNaN(orderId) ? orderId : parseInt(orderId, 10);
      }

      const result = await Order.deleteOne(query);
      if (result.deletedCount === 0) {
        throw new Error(`Order not found for orderId: ${orderId}`);
      }

      channel.ack(msg);
      //console.log(`Order ${orderId} deleted for owner ${ownerId}`);
    } catch (err) {
      console.error("Error deleting order:", err.message);
      channel.nack(msg, false, false);
    }
  });
};

module.exports = startOrderDeleteConsumer;
