const express = require("express");
const {
  addCustomer,
  bulkAddCustomers,
  bulkAddCustomersFromExcel,
  updateCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  queryCount,
  searchCustomers,
} = require("../controllers/customer.controller");

const router = express.Router();



router.get("/search", searchCustomers);

router.post("/", addCustomer);
router.post("/bulk", bulkAddCustomers);            
router.post("/bulk/excel", bulkAddCustomersFromExcel); 
router.put("/:customerId", updateCustomer);
router.delete("/:customerId", deleteCustomer);
router.get("/:customerId", getCustomer);
router.get("/", listCustomers);
router.post("/query-count", queryCount);


module.exports = router;
