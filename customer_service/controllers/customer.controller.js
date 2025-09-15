const mongoose = require("mongoose");

const { getChannel } = require("../config/rabbitmq");
const Customer = require("../models/customer.model");

const XLSX = require("xlsx");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() }); // in-memory for parsing
//const { getChannel } = require("../config/rabbitmq");



exports.addCustomer = async (req, res) => {
  try {
    const { name, email, phone, metadata } = req.body;
    const ownerId = req.headers["x-user-id"];

    //console.log("addCustomer - Raw body:", req.rawBody);
    //console.log("addCustomer - Parsed body:", req.body);
    //console.log("addCustomer - Headers:", req.headers);

    if (!name || !ownerId || !email) {
      //console.log("Missing required fields:", { name, ownerId, email });
      return res.status(400).json({ message: "Name, ownerId & email required" });
    }

    let channel;
    try {
      channel = getChannel();
    } catch (e) {
      console.error("RabbitMQ channel not initialized:", e);
      return res.status(500).json({ message: "RabbitMQ not connected" });
    }

    await channel.assertQueue("customerQueue", { durable: true });

    const payload = {
      ownerId,
      name,
      email,
      phone: phone || null,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    };

    channel.sendToQueue("customerQueue", Buffer.from(JSON.stringify(payload)));

    //console.log("Customer queued:", payload);
    //console.log("Current customer count (approx):", await Customer.countDocuments({ ownerId }));
    
    res.status(200).json({ message: "Customer queued for insertion", data: payload });
    //console.log("Response sent to client");
  } catch (err) {
    console.error("Error in addCustomer:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ✅ Update
exports.updateCustomer = async (req, res) => {
  try {
    const ownerId = req.headers["x-user-id"];
    const { customerId } = req.params;
    const updates = req.body;

    if (!ownerId || !customerId) {
      return res.status(400).json({ message: "ownerId and customerId required" });
    }

    let channel = getChannel();
    await channel.assertQueue("customerUpdateQueue", { durable: true });

    const payload = { ownerId, customerId, updates, timestamp: new Date().toISOString() };
    channel.sendToQueue("customerUpdateQueue", Buffer.from(JSON.stringify(payload)));

    res.status(200).json({ message: "Customer update queued", data: payload });
  } catch (err) {
    console.error("❌ updateCustomer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Delete
exports.deleteCustomer = async (req, res) => {
  try {
    const ownerId = req.headers["x-user-id"];
    const { customerId } = req.params;

    if (!ownerId || !customerId) {
      return res.status(400).json({ message: "ownerId and customerId required" });
    }

    let channel = getChannel();
    await channel.assertQueue("customerDeleteQueue", { durable: true });

    const payload = { ownerId, customerId };
    channel.sendToQueue("customerDeleteQueue", Buffer.from(JSON.stringify(payload)));

    res.status(200).json({ message: "Customer delete queued", data: payload });
  } catch (err) {
    console.error("❌ deleteCustomer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.getCustomer = async (req, res) => {
  try {
    const ownerId = req.headers["x-user-id"];
    const { customerId } = req.params;

    const customer = await Customer.findOne({ ownerId, customerId });
    if (!customer) return res.status(404).json({ message: "Not found" });

    res.status(200).json(customer);
  } catch (err) {
    console.error("❌ getCustomer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.listCustomers = async (req, res) => {
  try {
    const ownerId = req.headers["x-user-id"];
    const customers = await Customer.find({ ownerId }).sort({ createdAt: 1 });//do -1 if want latest first
    res.status(200).json(customers);
  } catch (err) {
    console.error("❌ listCustomers error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



// ✅ Bulk insert via JSON array
exports.bulkAddCustomers = async (req, res) => {
  try {
    const ownerId = req.headers["x-user-id"];
    const customers = req.body.customers; // expect [{ name, email, phone, metadata }, ...]

    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ message: "customers[] array required" });
    }
    if (!ownerId) {
      return res.status(400).json({ message: "ownerId missing in headers" });
    }

    let channel = getChannel();
    await channel.assertQueue("customerQueue", { durable: true });

    let queued = 0, skipped = 0, errors = [];

    customers.forEach((cust, i) => {
      if (cust && cust.name && cust.email) {
        const payload = {
          ownerId,
          name: cust.name,
          email: cust.email,
          phone: cust.phone || null,
          metadata: cust.metadata || {},
          timestamp: new Date().toISOString(),
        };
        channel.sendToQueue("customerQueue", Buffer.from(JSON.stringify(payload)));
        queued++;
      } else {
        skipped++;
        errors.push({ index: i, reason: "Missing name/email" });
      }
    });

    res.status(200).json({ message: "Bulk queued", queued, skipped, errors });
  } catch (err) {
    console.error("❌ bulkAddCustomers error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Bulk insert via Excel file
exports.bulkAddCustomersFromExcel = [
  upload.single("file"),
  async (req, res) => {
    try {
      const ownerId = req.headers["x-user-id"];
      if (!ownerId) return res.status(400).json({ message: "ownerId missing" });
      if (!req.file) return res.status(400).json({ message: "Excel file required" });

      // Parse Excel buffer
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      let channel = getChannel();
      await channel.assertQueue("customerQueue", { durable: true });

      let queued = 0, skipped = 0, errors = [];

      rows.forEach((row, i) => {
        if (row.Name && row.Email) {
          const payload = {
            ownerId,
            name: row.Name,
            email: row.Email,
            phone: row.Phone || null,
            metadata: {
              dob: row.DOB ? new Date(row.DOB) : undefined,
              gender: row.Gender || undefined,
              location: row.Location || undefined,
            },
            timestamp: new Date().toISOString(),
          };
          channel.sendToQueue("customerQueue", Buffer.from(JSON.stringify(payload)));
          queued++;
        } else {
          skipped++;
          errors.push({ index: i, reason: "Missing Name/Email" });
        }
      });

      res.status(200).json({ message: "Excel processed", queued, skipped, errors });
    } catch (err) {
      console.error("❌ bulkAddCustomersFromExcel error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
];


exports.queryCount = async (req, res) => {
  try {
    const ownerId = req.headers["x-owner-id"];
    const { rules } = req.body;

    if (!rules) return res.status(400).json({ message: "rules required" });

    // Simple filter builder for demo
    let filter = { ownerId };

    if (rules.rules && rules.rules.length) {
      rules.rules.forEach(r => {
        switch (r.operator) {
          case ">": filter[r.field] = { $gt: r.value }; break;
          case "<": filter[r.field] = { $lt: r.value }; break;
          case "=": filter[r.field] = r.value; break;
          case "==": filter[r.field] = r.value; break;
          default: break;
        }
      });
    }

    const count = await Customer.countDocuments(filter);
    res.json({ count });
  } catch (err) {
    console.error("❌ /customers/query-count error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.countCustomers = async (req, res) => {
  try {
    const ownerId = req.user?._id || req.query.ownerId;
    if (!ownerId) return res.status(400).json({ message: "ownerId missing" });

    const count = await Customer.countDocuments({ ownerId: new mongoose.Types.ObjectId(ownerId) });
    res.json({ count });
  } catch (err) {
    console.error("❌ /customers/count error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ✅ Search customers by id or name
exports.searchCustomers = async (req, res) => {
  try {
    const ownerId = req.headers["x-user-id"];
    const { q } = req.query; // search term

    if (!ownerId) {
      return res.status(400).json({ message: "ownerId missing in headers" });
    }
    if (!q) {
      return res.status(400).json({ message: "query param 'q' required" });
    }

    const searchRegex = new RegExp(q, "i"); // case-insensitive

    const customers = await Customer.find({
      ownerId,
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { customerId: isNaN(q) ? undefined : Number(q) }, // numeric search
      ].filter(Boolean),
    })
      .select("customerId name email phone")
      .limit(10);

    res.status(200).json(customers);
  } catch (err) {
    console.error("❌ searchCustomers error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
