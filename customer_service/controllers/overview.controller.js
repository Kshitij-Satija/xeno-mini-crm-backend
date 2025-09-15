const Customer = require("../models/customer.model");
const Order = require("../models/order.model");
const mongoose = require("mongoose");

exports.getDashboardStats = async (req, res) => {
  try {
    const ownerId = req.user?._id || req.query.ownerId;
    if (!ownerId) return res.status(400).json({ message: "ownerId missing" });

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    // Customers
    const recentCustomersPromise = Customer.find({ ownerId: ownerObjectId })
      .sort({ createdAt: -1 })
      .limit(5);

    const totalCustomersPromise = Customer.countDocuments({ ownerId: ownerObjectId });

    const totalLifetimeSpendPromise = Customer.aggregate([
      { $match: { ownerId: ownerObjectId } },
      { $group: { _id: null, total: { $sum: "$lifetimeSpend" } } },
    ]);

    const genderDistPromise = Customer.aggregate([
      { $match: { ownerId: ownerObjectId } },
      { $group: { _id: "$metadata.gender", count: { $sum: 1 } } },
    ]);

    // Age distribution buckets
    const ageDistPromise = Customer.aggregate([
      { $match: { ownerId: ownerObjectId, "metadata.dob": { $exists: true } } },
      {
        $project: {
          age: {
            $floor: {
              $divide: [{ $subtract: [new Date(), "$metadata.dob"] }, 1000 * 60 * 60 * 24 * 365],
            },
          },
        },
      },
      {
        $bucket: {
          groupBy: "$age",
          boundaries: [0, 18, 25, 35, 45, 60, 100],
          default: "60+",
          output: { count: { $sum: 1 } },
        },
      },
    ]);

    // Orders 
    const totalOrdersPromise = Order.countDocuments({ ownerId: ownerObjectId });

    const totalRevenuePromise = Order.aggregate([
      { $match: { ownerId: ownerObjectId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const ordersByStatusPromise = Order.aggregate([
      { $match: { ownerId: ownerObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const recentOrdersPromise = Order.find({ ownerId: ownerObjectId })
      .sort({ date: -1 })
      .limit(5);

    // Execute all promises in parallel 
    const [
      recentCustomers,
      totalCustomers,
      lifetimeSpendAgg,
      genderDist,
      ageDist,
      totalOrders,
      revenueAgg,
      ordersByStatus,
      recentOrders,
    ] = await Promise.all([
      recentCustomersPromise,
      totalCustomersPromise,
      totalLifetimeSpendPromise,
      genderDistPromise,
      ageDistPromise,
      totalOrdersPromise,
      totalRevenuePromise,
      ordersByStatusPromise,
      recentOrdersPromise,
    ]);

    // Format gender distribution
    const genderDistribution = genderDist.reduce((acc, cur) => {
      acc[cur._id || "Unknown"] = cur.count;
      return acc;
    }, {});

    // Format age distribution
    const ageDistribution = ageDist.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});

    // Format orders by status
    const ordersByStatusMap = ordersByStatus.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});

    res.json({
      totalCustomers,
      totalOrders,
      totalLifetimeSpend: lifetimeSpendAgg[0]?.total || 0,
      totalRevenue: revenueAgg[0]?.total || 0,
      genderDistribution,
      ageDistribution,
      recentCustomers,
      ordersByStatus: ordersByStatusMap,
      recentOrders,
    });
  } catch (err) {
    console.error("/dashboard-stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
