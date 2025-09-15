const { getChannel } = require("../config/rabbitmq");
const Order = require("../models/order.model");
const mongoose = require("mongoose");

const VALID_STATUSES = ["PENDING", "SHIPPED", "COMPLETED"];

const startOrderUpdateConsumer = async () => {
  const channel = getChannel();
  await channel.assertQueue("orderUpdateQueue", { durable: true });

  channel.consume("orderUpdateQueue", async (msg) => {
    if (!msg) return;
    try {
      const { ownerId, orderId, updates } = JSON.parse(msg.content.toString());
      if (!ownerId || !orderId || !updates) {
        throw new Error("Missing ownerId, orderId, or updates");
      }

      // Validate status
      if (updates.status) {
        const newStatus = updates.status.toUpperCase();
        if (!VALID_STATUSES.includes(newStatus)) {
          throw new Error(`Invalid status value: ${updates.status}`);
        }
        updates.status = newStatus;
      }

      let query = { ownerId: new mongoose.Types.ObjectId(ownerId) };
      if (orderId.match && orderId.match(/^[0-9a-fA-F]{24}$/)) {
        query._id = orderId;
      } else {
        query.orderId = isNaN(orderId) ? orderId : parseInt(orderId, 10);
      }

      const result = await Order.updateOne(query, { $set: updates });
      if (result.matchedCount === 0) {
        throw new Error(`Order not found for orderId: ${orderId}`);
      }

      channel.ack(msg);
      //console.log(`Order ${orderId} updated for owner ${ownerId}`);
    } catch (err) {
      console.error("Error updating order:", err.message);
      channel.nack(msg, false, false);
    }
  });
};

module.exports = startOrderUpdateConsumer;
