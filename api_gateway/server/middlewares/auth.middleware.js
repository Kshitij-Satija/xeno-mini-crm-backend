const ensureAuth = (req, res, next) => {
  console.log("🔑 ensureAuth called");
  console.log("req.isAuthenticated():", req.isAuthenticated());
  console.log("req.user:", req.user);

  if (req.isAuthenticated()) {
    return next(); 
  }
  res.status(401).json({ message: "Not authenticated" });
};

module.exports = { ensureAuth };
