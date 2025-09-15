const express = require("express");
const {
  addOrder,
  updateOrder,
  deleteOrder,
  getOrder,
  listOrders,
  bulkAddOrders,
  bulkAddOrdersFromExcel,
} = require("../controllers/order.controller");

const router = express.Router();

router.post("/", addOrder);
router.put("/:orderId", updateOrder);
router.delete("/:orderId", deleteOrder);
router.get("/:orderId", getOrder);
router.get("/", listOrders);

// Bulk routes
router.post("/bulk", bulkAddOrders);             
router.post("/bulk/excel", bulkAddOrdersFromExcel);



module.exports = router;
