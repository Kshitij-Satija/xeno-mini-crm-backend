const FRONTEND_URI = process.env.FRONTEND_URI;

exports.loginSuccess = (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });
  res.set("Cache-Control", "no-store"); 
  res.json(req.user);
};


exports.logoutUser = (req, res) => {
  req.logout(() => {
    // Clear session cookie if needed
    res.json({ message: "Logged out successfully" });
  });
};
