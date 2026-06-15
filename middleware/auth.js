const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/users/login');
    }
    next();
};

module.exports = { requireAuth };
