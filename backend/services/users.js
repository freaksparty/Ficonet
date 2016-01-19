var dbServices = require("./base"),
    db         = require("../models"),
    utils      = require("../utils"),
    consts     = require("../utils/consts"),
    errors     = require("./errors/errors.js"),
    makePassword, makeHash, changePassword, sendEmail, ATTRS, model, User;


ATTRS = ["id", "username", "password", "email", "place", "role", "created_at", "last_modified"];

model = db.User;
User = db.User;


makePassword = function (user, end) {
    utils.tryThrowableFunction(function () { 
        if(user.password) {
            user.password = model.generateHash(user.password, user.email);
        }
    }, end); 
};

makeHash = function (user, end) {
    utils.tryThrowableFunction(function () { 
        user.newpassword = model.generateHash(user.email, ""+Math.random());
    }, end);
}; 

sendEmail = function (user, end) {
    utils.tryThrowableFunction(function () { 
        utils.sendEmail(
            user.email, 
            "FICONET: Cambio de contraseña", 
            "Acceda al siguiente enlace para cambiar la contraseña: <a href='http://192.168.0.30:8080/changepassword/"+user.newpassword+"'>Cambiar contraseña</a><br>Consulte con alguien de la organización si tiene algún problema", 
            end);
    }, end);
};

module.exports = {
    createUser: function (data, done) {

        dbServices.create({
            model : model, 
            obj   : data, 
            attrs : ATTRS, 
            done  : done
        }).onLoad(function (user, cfg) {
            var now = new Date();

            user.created_at    = now;
            user.last_modified = now;

            delete user.role;
            delete user.id;
            delete user.newpassword;

            return makePassword(user, !!user.password, cfg.end);
        }).onSuccess (function (user, cfg) {
            if(user){
                delete user.dataValues.password;
                delete user.dataValues.newpassword;
                delete user.dataValues.deleted;

                return cfg.end(200, user);
            } else {
                return cfg.end(500, consts.ERROR.UNKNOWN);
            }
        }).exec();
    },


    updateUser : function (id, roleChanged, updatePassword, data, done) {
        var userPass;

        dbServices.update({
            model : model, 
            id    : id,
            obj   : data,
            attrs : ATTRS,
            done  : done
        }).config(function (cfg) {
            cfg.deleted = false;
        }).onLoad(function (user, cfg) {
            if(!roleChanged) {
                delete user.role;
            } else if(user.role === "god"){
                return cfg.end(403, consts.ERROR.FORBIDDEN);
            }

            if(updatePassword) userPass = user.password;

            delete user.id;
            delete user.password;
            delete user.created_at;
            delete user.newpassword;

            user.last_modified = new Date();
        }).onSearch(function (user, cfg) {
            if(updatePassword) {
                user.password = userPass;
                makePassword(user, cfg.end);
            }
        }).onSuccess (function (user, cfg) {
            if(user){
                delete user.dataValues.password;
                delete user.dataValues.newpassword;
                delete user.dataValues.deleted;

                return cfg.end(200, user);
            } else {
                return cfg.end(500, consts.ERROR.UNKNOWN);
            }
        }).exec();
    },


    removeUser : function (id, done) {
        dbServices.remove({
            model : model, 
            id    : id,
            done  : done
        }).onSearch(function (user, cfg) {
            if(user.role === 'god') {
                return cfg.end(403, consts.ERROR.FORBIDDEN);
            }
        }).onSuccess (function (user, cfg) {
            if(user){
                return cfg.end(200, user.id);
            } else {
                return cfg.end(500, consts.ERROR.UNKNOWN);
            }
        }).exec();
    },


    hardRemoveUser : function (id, done) {
        dbServices.hardRemove({
            model : model, 
            id    : id,
            done  : done
        }).onSearch(function (user, cfg) {
            if(user.role === 'god') {
                return cfg.end(403, consts.ERROR.FORBIDDEN);
            }
        }).onSuccess (function (user, cfg) {
            if(user){
                return cfg.end(200, user.id);
            } else {
                return cfg.end(500, consts.ERROR.UNKNOWN);
            }
        }).exec();
    },

    generateNewPasswordHash : function (email, done) {
        var userPass;

        dbServices.update({
            model : model, 
            field : "email",
            value : email,
            obj   : {email : email},
            attrs : ATTRS,
            done  : done
        }).config(function (cfg) {
            cfg.deleted = false;
        }).onLoad(function (user, cfg) {
            delete user.role;
            delete user.id;
            delete user.password;
            delete user.created_at;
            delete user.username;
            delete user.newpassword;

            if(!user.email) cfg.end(400, consts.ERROR.BAD_REQUEST);

            user.last_modified = new Date();
        }).onSearch(function (user, cfg) {
            makeHash(user, cfg.end);
        }).onSuccess (function (user, cfg) {
            if(user){
                return sendEmail(user, cfg.end);
            } else {
                return cfg.end(500, consts.ERROR.UNKNOWN);
            }
        }).exec();
    },

    changePassword : function (code, password, isCode, done) {
        var field = isCode ? 'newpassword' : 'id';

        dbServices.update({
            model : model, 
            field : field,
            value : code,
            obj   : { password : password },
            attrs : ATTRS,
            done  : done
        }).config(function (cfg) {
            cfg.deleted = false;
        }).onLoad(function (user, cfg) {
            user.last_modified = new Date();
        }).onSearch(function (user, cfg) {
            user.newpassword = null;
            makePassword(user, cfg.end);
        }).onSuccess (function (user, cfg) {
            if(user){
                return cfg.end(200, "OK");
            } else {
                return cfg.end(500, consts.ERROR.UNKNOWN);
            }
        }).exec();
    },

    retrieveDeleteUser : function (id, done) {
        dbServices.update({
            model : model, 
            id    : id,
            obj   : {deleted: false},
            done  : done
        }).config(function (cfg) {
            cfg.deleted = true;
        }).onLoad(function (user, cfg) {
            user.last_modified = new Date();
        }).onSearch(function (user, cfg) {
            user.deleted = false;
        }).onSuccess (function (user, cfg) {
            if(user){
                return cfg.end(200, "OK");
            } else {
                return cfg.end(500, consts.ERROR.UNKNOWN);
            }
        }).exec();
    },


    getUsers : function (deleted, done) {
        var attrs = ["id", "username", "email", "place", "role", "created_at", "last_modified", "deleted"];

        User.findAll({
            where: utils.makeBaseWhere({}, deleted),
            attributes: attrs,
            raw: true
        }).then(function (users) {
            return done(200, users);
        }).catch(function (error) {
            return done(500, error);
        });
    },


    getUser : function (id, done) {
        var attrs = ["id", "username", "email", "place", "role", "created_at", "last_modified"];

        db.User.findById(id, {
            raw: true, 
            attributes: attrs
        }).then(function (user) {
            if(!user) { throw new errors.ElementNotFoundError() }
                
            return done(200, user);
        }).catch(errors.ElementNotFoundError, function (err) {
            return done(404, err);
        }).catch(function (err) {
            console.log(JSON.stringify(err));
            return done(500, err);
        });
    }
}