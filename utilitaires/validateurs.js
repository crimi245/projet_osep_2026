const Joi = require('joi');

const schemas = {
    login: Joi.object({
        username: Joi.string().min(2).max(30).required(),
        password: Joi.string().required(),
        theme: Joi.string().valid('green', 'orange', 'vert').optional(),
        browser_fingerprint: Joi.any().optional()
    }),

    createMeeting: Joi.object({
        title: Joi.string().min(3).max(100).required(),
        // Accepter 'start' et 'start_time' pour la compatibilité ascendante
        start: Joi.date().iso().optional(),
        start_time: Joi.date().iso().optional(),
        end: Joi.date().iso().optional(),
        end_time: Joi.date().iso().optional(),
        description: Joi.string().allow('', null),
        location: Joi.string().allow('', null),
        color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/),
        coordination_id: Joi.alternatives().try(Joi.number().integer(), Joi.string().allow('new', ''))
    }).or('start', 'start_time').or('end', 'end_time')
};

const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: `Erreur de validation: ${error.details[0].message}` });
    }
    next();
};

module.exports = { schemas, validate };
