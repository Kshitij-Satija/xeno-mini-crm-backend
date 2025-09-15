const { getChannel } = require("../config/rabbitmq");
const Customer = require("../models/customer.model");
const Counter = require("../models/counter.model");

const startCustomerConsumer = async () => {
  const channel = getChannel();
  await channel.assertQueue("customerQueue", { durable: true });

  channel.consume("customerQueue", async (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());

      if (!data.ownerId || !data.email) {
        console.warn("Skipped invalid message:", data);
        return channel.ack(msg); // ack to drop bad message
      }

      // Increment counter for customers
      const counter = await Counter.findOneAndUpdate(
        { ownerId: data.ownerId, type: "customer" },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );

      const nextId = counter.seq;

      // Prevent duplicate email per owner
      const exists = await Customer.findOne({ ownerId: data.ownerId, email: data.email });
      if (exists) {
        console.warn(`Duplicate skipped: ${data.email} for owner ${data.ownerId}`);
        return channel.ack(msg);
      }

      await Customer.create({
        customerId: nextId,
        ownerId: data.ownerId,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        metadata: data.metadata || {},
        createdAt: data.timestamp || new Date(),
      });

      channel.ack(msg);
      //console.log(`Customer saved (customerId: ${nextId}) for owner ${data.ownerId}`);
    } catch (err) {
      console.error("Error saving customer:", err.message);
      channel.ack(msg); // acknowledge to prevent poison message loops
    }
  });
};

module.exports = startCustomerConsumer;
