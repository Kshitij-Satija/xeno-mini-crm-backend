const { getChannel } = require("../config/rabbitmq");
const Order = require("../models/order.model");
const Customer = require("../models/customer.model");
const Counter = require("../models/counter.model");
const mongoose = require("mongoose");

const startOrderConsumer = async () => {
  const channel = getChannel();
  await channel.assertQueue("orderQueue", { durable: true });

  channel.consume("orderQueue", async (msg) => {
    if (!msg) return;

    let session;
    try {
      const data = JSON.parse(msg.content.toString());
      if (!data.ownerId || !data.customerId || typeof data.amount === "undefined") {
        throw new Error("Missing ownerId, customerId, or amount");
      }

      // Convert ownerId to ObjectId
      let ownerObjectId;
      try {
        ownerObjectId = new mongoose.Types.ObjectId(data.ownerId);
      } catch (e) {
        throw new Error("Invalid ownerId");
      }

      // Find customer (ObjectId or numeric per-owner customerId)
      let customer;
      if (mongoose.Types.ObjectId.isValid(String(data.customerId))) {
        customer = await Customer.findOne({ _id: data.customerId, ownerId: ownerObjectId });
      }
      if (!customer && !isNaN(data.customerId)) {
        customer = await Customer.findOne({
          customerId: parseInt(data.customerId, 10),
          ownerId: ownerObjectId,
        });
      }
      if (!customer) throw new Error("Customer not found for this owner");

      // Atomically increment order counter for this owner
      const counter = await Counter.findOneAndUpdate(
        { ownerId: ownerObjectId, type: "order" },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );
      const nextOrderId = counter.seq;

      const validStatuses = ["PENDING", "SHIPPED", "COMPLETED"];
      const orderPayload = {
        orderId: nextOrderId,
        ownerId: ownerObjectId,
        customerId: customer._id,
        customerNumericId: customer.customerId,
        amount: data.amount,
        status: validStatuses.includes((data.status || "").toUpperCase())
          ? data.status.toUpperCase()
          : "PENDING",
        date: data.timestamp ? new Date(data.timestamp) : new Date(),
      };

      // Transaction attempt
      let usedTransaction = false;
      try {
        session = await mongoose.startSession();
        session.startTransaction();
        usedTransaction = true;

        await Order.create([orderPayload], { session });

        await Customer.updateOne(
          { _id: customer._id },
          {
            $inc: { totalOrders: 1, lifetimeSpend: data.amount },
            $set: { lastOrderDate: orderPayload.date },
          },
          { session }
        );

        await session.commitTransaction();
        session.endSession();
      } catch (txErr) {
        if (session) {
          try {
            await session.abortTransaction();
            session.endSession();
          } catch (e) {}
        }

        console.warn("Transaction failed, fallback:", txErr.message);

        await Order.create(orderPayload);

        await Customer.updateOne(
          { _id: customer._id },
          {
            $inc: { totalOrders: 1, lifetimeSpend: data.amount },
            $set: { lastOrderDate: orderPayload.date },
          }
        );
      }

      channel.ack(msg);
      //console.log(`Order saved (orderId: ${nextOrderId}) for owner ${ownerObjectId}. Transaction used: ${usedTransaction}`);
    } catch (err) {
      console.error("Error saving order:", err.message);
      channel.nack(msg, false, false);
    } finally {
      if (session && session.inTransaction()) {
        try {
          await session.abortTransaction();
          session.endSession();
        } catch (e) {}
      }
    }
  });
};

module.exports = startOrderConsumer;
