const Application = require('../models/Application');

exports.getApplicationById = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id)
            .populate({
                path: 'job',
                populate: { path: 'recruiter', select: 'name email phone company' }
            })
            .populate('user', 'name email');

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        res.status(200).json(application);
    } catch (err) {
        console.error('❌ Error fetching application by ID:', err);
        res.status(500).json({ message: 'Server error while fetching application' });
    }
};
