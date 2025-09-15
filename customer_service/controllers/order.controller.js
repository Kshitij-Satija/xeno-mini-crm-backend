const mongoose = require("mongoose");

const { getChannel } = require("../config/rabbitmq");
const Order = require("../models/order.model");
const Customer = require("../models/customer.model");

const XLSX = require("xlsx");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() }); 
// Valid statuses ENUM
const VALID_STATUSES = ["PENDING", "SHIPPED", "COMPLETED"];

exports.addOrder = async (req, res) => {
  try {
    let { customerId, amount } = req.body;
    const ownerId = req.headers["x-user-id"];

    if (!customerId || typeof amount === "undefined" || !ownerId) {
      return res.status(400).json({ message: "customerId, amount & ownerId required" });
    }

    // Convert ownerId to ObjectId
    let ownerObjectId;
    try {
      ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    } catch (e) {
      return res.status(400).json({ message: "Invalid ownerId" });
    }

    // Resolve customer for the owner
    let customer;
    if (typeof customerId === "string" && customerId.match(/^[0-9a-fA-F]{24}$/)) {
      customer = await Customer.findOne({ _id: customerId, ownerId: ownerObjectId });
    } else {
      customer = await Customer.findOne({
        customerId: parseInt(customerId, 10),
        ownerId: ownerObjectId,
      });
    }

    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const payload = {
      ownerId: ownerObjectId,              
      customerId: customer._id.toString(),
      customerNumericId: customer.customerId,
      amount,
      status: "PENDING",
      timestamp: new Date().toISOString(),
    };

    const channel = getChannel();
    await channel.assertQueue("orderQueue", { durable: true });
    channel.sendToQueue("orderQueue", Buffer.from(JSON.stringify(payload)));

    res.status(200).json({ message: "Order queued for insertion", data: payload });
  } catch (err) {
    console.error("addOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


//  helper to safely cast ownerId to ObjectId
function toObjectId(id) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

//  Update Order
exports.updateOrder = async (req, res) => {
  try {
    const ownerObjectId = toObjectId(req.headers["x-user-id"]);
    const { orderId } = req.params;
    const updates = req.body;

    if (!ownerObjectId || !orderId) {
      return res.status(400).json({ message: "Valid ownerId and orderId required" });
    }

    // Validate status if sent
    if (updates.status) {
      const newStatus = updates.status.toUpperCase();
      if (!VALID_STATUSES.includes(newStatus)) {
        return res.status(400).json({ message: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}` });
      }
      updates.status = newStatus;
    }

    const channel = getChannel();
    await channel.assertQueue("orderUpdateQueue", { durable: true });

    const payload = { ownerId: ownerObjectId, orderId, updates, timestamp: new Date().toISOString() };
    channel.sendToQueue("orderUpdateQueue", Buffer.from(JSON.stringify(payload)));

    res.status(200).json({ message: "Order update queued", data: payload });
  } catch (err) {
    console.error("updateOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const ownerObjectId = toObjectId(req.headers["x-user-id"]);
    const { orderId } = req.params;

    if (!ownerObjectId || !orderId) {
      return res.status(400).json({ message: "Valid ownerId and orderId required" });
    }

    const channel = getChannel();
    await channel.assertQueue("orderDeleteQueue", { durable: true });

    const payload = { ownerId: ownerObjectId, orderId, timestamp: new Date().toISOString() };
    channel.sendToQueue("orderDeleteQueue", Buffer.from(JSON.stringify(payload)));

    res.status(200).json({ message: "Order delete queued", data: payload });
  } catch (err) {
    console.error("deleteOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const ownerObjectId = toObjectId(req.headers["x-user-id"]);
    const { orderId } = req.params;

    if (!ownerObjectId) {
      return res.status(400).json({ message: "Invalid ownerId" });
    }

    let query = { ownerId: ownerObjectId };
    if (orderId.match && orderId.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = orderId;
    } else {
      query.orderId = isNaN(orderId) ? orderId : parseInt(orderId, 10);
    }

    const order = await Order.findOne(query).populate("customerId", "name email");
    if (!order) return res.status(404).json({ message: "Order not found" });

    res.status(200).json(order);
  } catch (err) {
    console.error("getOrder error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.listOrders = async (req, res) => {
  try {
    const ownerObjectId = toObjectId(req.headers["x-user-id"]);
    if (!ownerObjectId) return res.status(400).json({ message: "Invalid ownerId" });

    const orders = await Order.find({ ownerId: ownerObjectId })
      .populate("customerId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(orders);
  } catch (err) {
    console.error("listOrders error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.bulkAddOrders = async (req, res) => {
  try {
    const ownerObjectId = toObjectId(req.headers["x-user-id"]);
    const orders = req.body.orders;

    if (!ownerObjectId || !Array.isArray(orders)) {
      return res.status(400).json({ message: "Valid ownerId header and orders[] required" });
    }

    const channel = getChannel();
    await channel.assertQueue("orderQueue", { durable: true });

    let queued = 0, skipped = 0, errors = [];

    orders.forEach((o, i) => {
      if (o.customerId && typeof o.amount !== "undefined") {
        const payload = {
          ownerId: ownerObjectId,
          customerId: o.customerId,
          amount: parseFloat(o.amount),
          status: o.status || "PENDING",
          timestamp: new Date().toISOString(),
        };
        channel.sendToQueue("orderQueue", Buffer.from(JSON.stringify(payload)));
        queued++;
      } else {
        skipped++;
        errors.push({ index: i, reason: "Missing customerId or amount" });
      }
    });

    res.status(200).json({ message: "Bulk orders queued", queued, skipped, errors });
  } catch (err) {
    console.error("bulkAddOrders error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.bulkAddOrdersFromExcel = [
  upload.single("file"),
  async (req, res) => {
    try {
      const ownerObjectId = toObjectId(req.headers["x-user-id"]);
      if (!ownerObjectId) return res.status(400).json({ message: "Invalid ownerId" });
      if (!req.file) return res.status(400).json({ message: "Excel file required" });

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const channel = getChannel();
      await channel.assertQueue("orderQueue", { durable: true });

      let queued = 0, skipped = 0, errors = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Validate Customer
        const customer = await Customer.findOne({ customerId: parseInt(row["Customer ID"], 10), ownerId: ownerObjectId });
        if (!customer) {
          skipped++;
          errors.push({ index: i, reason: "Customer not found" });
          continue;
        }

        // Validate Amount
        const amount = parseFloat(row["Amount"]);
        if (isNaN(amount)) {
          skipped++;
          errors.push({ index: i, reason: "Invalid amount" });
          continue;
        }

        // Validate Status
        const status = (row["Status"] || "PENDING").toUpperCase();
        const finalStatus = VALID_STATUSES.includes(status) ? status : "PENDING";

        // Prepare payload
        const payload = {
          ownerId: ownerObjectId,
          customerId: customer._id.toString(),
          customerNumericId: customer.customerId,
          amount,
          status: finalStatus,
          timestamp: new Date().toISOString(),
        };

        channel.sendToQueue("orderQueue", Buffer.from(JSON.stringify(payload)));
        queued++;
      }

      res.status(200).json({ message: "Excel processed", queued, skipped, errors });
    } catch (err) {
      console.error("bulkAddOrdersFromExcel error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
];

exports.countOrders = async (req, res) => {
  try {
    const ownerId = req.user?._id || req.query.ownerId;
    const ownerObjectId = toObjectId(ownerId);
    if (!ownerObjectId) return res.status(400).json({ message: "Invalid ownerId" });

    const count = await Order.countDocuments({ ownerId: ownerObjectId });
    res.json({ count });
  } catch (err) {
    console.error("/orders/count error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
