const express = require("express");
const router = express.Router();
const assert = require("assert");
const { randomInt } = require("crypto");
const { urlencoded } = require("express");
const { check, validationResult } = require('express-validator');
const { nextTick } = require("process");
let objId = 0;

//#region helpers
let dateToStrPretty = function () {
    let date = new Date();
    return date.getDate() + "/ " + (date.getMonth() + 1) + "/ " + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
}
const errMain = "ERROR READING MAINDATA";
const errArticles = "ERROR READING ARTICLES";
const errDrafts = "ERROR READING DRAFTS";
const errComments = "ERROR READING COMMENTS";
const sqlMain = "SELECT * FROM mainData";
const sqlArticles = "SELECT * FROM articles WHERE article_type='article';";
const sqlDrafts = "SELECT * FROM articles WHERE article_type='draft';";
//#endregion
router.get("/", (req, res, next) => {
    global.db.all(sqlMain, function (err, rows) {
        if (err) {
            console.log(errMain);
            next(err);
        }
        else {
            let title = rows[0].mainData_title;
            let subtitle = rows[0].mainData_subtitle;
            let author = rows[0].mainData_author;
            global.db.all(sqlArticles, function (err, rows) {
                if (err) {
                    console.log(errArticles);
                    next(err);
                }
                else {
                    let articles = rows;
                    global.db.all(sqlDrafts, function (err, rows) {
                        if (err) {
                            console.log(errDrafts);
                            next(err);
                        }
                        else {
                            let drafts = rows;
                            res.render("indexAuthor", {
                                title: title,
                                subtitle: subtitle,
                                author: author,
                                aRows: articles,
                                dRows: drafts
                            });
                        }
                    });
                }
            });
        }
    });

});
router.post("/",
    [check('title', 'Title cannot be empty!').exists().trim().escape().notEmpty(),
    check('sub', 'Subtitle cannot be empty!').exists().trim().escape().notEmpty(),
    check('auth', 'Author cannot be empty!').exists().trim().escape().notEmpty(),
    check('delete', 'no delete').exists(),
    check('publish', 'no publish').exists()
    ],
    (req, res, next) => {
        global.db.all(sqlMain, function (err, rows) {
            if (err) {
                console.log(errMain);
                next(err);
            }
            else {
                let title = rows[0].mainData_title;
                let subtitle = rows[0].mainData_subtitle;
                let author = rows[0].mainData_author;

                let validArr = validationResult(req).array();
                //check if settings post error was caught
                if (validArr.some(e => e.msg === 'no delete') && validArr.some(e => e.msg === 'no publish') && validArr.length > 2) {
                    validArr.splice(validArr.findIndex(e => e.msg === 'no delete'), 1);
                    validArr.splice(validArr.findIndex(e => e.msg === 'no publish'), 1);

                    res.render("settingsAuthor", {
                        title: title,
                        subtitle: subtitle,
                        author: author,
                        err: validArr
                    });
                }
                else {
                    let formData = req.body;
                    //update title,sub,author or prevent update on wrong post
                    if (formData.title.trim() && formData.sub.trim() && formData.auth.trim()) {
                        global.db.run("UPDATE mainData SET mainData_title= ?, mainData_subtitle= ?, mainData_author = ? WHERE mainData_id = 1;",
                            [formData.title, formData.sub, formData.auth], function (err) {
                                if (err) {
                                    console.log("ERROR WHEN UPDATING MAINDATA");
                                    next(err);
                                }
                            });
                        title = formData.title;
                        subtitle = formData.sub;
                        author = formData.auth;
                    }
                    if (formData.delete != null) {
                        global.db.run("DELETE FROM articles WHERE article_id = ?;", [formData.delete], function (err) {
                            if (err) {
                                console.log("ERROR DELETING DRAFT");
                                next(err);
                            }
                        });
                    }
                    if (formData.publish != null) {
                        global.db.run("UPDATE articles SET article_type = 'article', article_published = ? WHERE article_id = ?;", [dateToStrPretty(), formData.publish], function (err) {
                            if (err) {
                                console.log("ERROR PUBLISHING DRAFT");
                            }
                        });
                    }
                    global.db.all(sqlDrafts, function (err, rows) {
                        if (err) {
                            console.log(err);
                            next(err);
                        }
                        else {
                            let drafts = rows;
                            global.db.all(sqlArticles, function (err, rows) {
                                if (err) {
                                    console.log(errArticles);
                                    next(err);
                                }
                                else {

                                    res.render("indexAuthor", {
                                        title: title,
                                        subtitle: subtitle,
                                        author: author,
                                        aRows: rows,
                                        dRows: drafts
                                    });
                                }
                            });
                        }
                    });
                }
            }
        });
    });

router.get("/edit", (req, res, next) => {

    if (req.query.id != "New Draft") {
        global.db.all("SELECT * FROM articles WHERE article_id = ?", [parseInt(req.query.id)], function (err, rows) {
            if (err) {
                console.log("ERROR IMPORTING DRAFT");
                next(err);
            }
            else {
                res.render("editArticleAuthor", {
                    title: rows[0].article_title,
                    subtitle: rows[0].article_subtitle,
                    text: rows[0].article_text,
                    id: rows[0].article_id,
                    err: ""
                });
            }
        });
    }
    else {

        res.render("editArticleAuthor", {
            title: 'New Draft',
            subtitle: "Some Subtitle",
            text: 'Some text',
            id: req.query.id,
            err: ""
        });
    }

});

router.post("/edit",
    [check('title', 'Title cannot be empty!').exists().trim().escape().notEmpty(),
    check('sub', 'Subtitle cannot be empty!').exists().trim().escape().notEmpty(),
    check('text', 'Text cannot be empty!').exists().trim().escape().notEmpty()],
    (req, res, next) => {
        let validArr = validationResult(req).array();
        //error msg, no submission

        let date = dateToStrPretty();
        //check if entry exists
        console.log("reqId: " + req.body.id);
        if (req.body.id == "New Draft") {
            global.db.run("INSERT INTO articles (article_title, article_subtitle, article_text, article_created, article_modified) VALUES (?, ?, ?, ?, ?);", [req.body.title, req.body.sub, req.body.text, date, date], function (err) {
                if (err) {
                    console.log("ERROR INSERTING");
                    next(err);
                }
            });
        }
        if(req.body.id == "New Draft"){
            global.db.all("SELECT * FROM articles WHERE article_title = ? AND article_subtitle = ? AND article_text = ? AND article_created = ?  AND article_modified = ?", [req.body.title, req.body.sub, req.body.text, date, date], function (err, rows) {
                if (err) {
                    console.log("ERROR SEARCHING FOR NEW ENTRY");
                    next(err);
                }
                else {
                    console.log("successful search");
                    console.log(rows);
                    req.body.id = rows[0].article_id;
                    global.db.all("SELECT * FROM articles WHERE article_id = ?", [parseInt(req.body.id)], function (err, rows) {
            
                        if (err) {
                            console.log("ERROR WHEN GETTING OBJECT BY ID");
                            next(err);
                        }
                        else {
                            let title = req.body.title;
                            let subtitle = req.body.sub;
                            let text = req.body.text;
            
                            if (validArr.length != 0) {
            
                                if (!validArr.some(e => e.msg == 'Title cannot be empty!')) {
                                    title = rows[0].article_title;
                                }
                                if (!validArr.some(e => e.msg == 'Subtitle cannot be empty!')) {
                                    subtitle = rows[0].article_subtitle;
                                }
                                if (!validArr.some(e => e.msg == 'Text cannot be empty!')) {
                                    text = rows[0].article_text;
                                }
                            }
                            else {
                                validArr = [{ msg: 'Successful Submission! Press back to return to home.' }];
                                global.db.run("UPDATE articles SET article_title=?, article_subtitle=?,article_text=? WHERE article_id = ?", [title, subtitle, text, parseInt(req.body.id)], function (err) {
                                    if (err) {
                                        console.log("ERROR AT ARTICLES UPDATE");
                                        next(err);
                                    }
                                });
                            }
                            res.render("editArticleAuthor", {
                                title: title,
                                subtitle: subtitle,
                                text: text,
                                id: rows[0].article_id,
                                err: validArr
                            });
                        }
            
                    });
                }
            });
        }
        else{
            global.db.all("SELECT * FROM articles WHERE article_id = ?", [parseInt(req.body.id)], function (err, rows) {
            
                if (err) {
                    console.log("ERROR WHEN GETTING OBJECT BY ID");
                    next(err);
                }
                else {
                    let title = req.body.title;
                    let subtitle = req.body.sub;
                    let text = req.body.text;
    
                    if (validArr.length != 0) {
    
                        if (!validArr.some(e => e.msg == 'Title cannot be empty!')) {
                            title = rows[0].article_title;
                        }
                        if (!validArr.some(e => e.msg == 'Subtitle cannot be empty!')) {
                            subtitle = rows[0].article_subtitle;
                        }
                        if (!validArr.some(e => e.msg == 'Text cannot be empty!')) {
                            text = rows[0].article_text;
                        }
                    }
                    else {
                        validArr = [{ msg: 'Successful Submission! Press back to return to home.' }];
                        global.db.run("UPDATE articles SET article_title=?, article_subtitle=?,article_text=? WHERE article_id = ?", [title, subtitle, text, parseInt(req.body.id)], function (err) {
                            if (err) {
                                console.log("ERROR AT ARTICLES UPDATE");
                                next(err);
                            }
                        });
                    }
                    res.render("editArticleAuthor", {
                        title: title,
                        subtitle: subtitle,
                        text: text,
                        id: rows[0].article_id,
                        err: validArr
                    });
                }
    
            });
        }
       
    });

router.get("/settings", (req, res, next) => {
    global.db.all(sqlMain, function (err, rows) {
        if (err) {
            console.log(errMain);
            next(err);
        }
        else {
            let title = rows[0].mainData_title;
            let subtitle = rows[0].mainData_subtitle;
            let author = rows[0].mainData_author;
            res.render("settingsAuthor", {
                title: title,
                subtitle: subtitle,
                author: author,
                err: ""
            });
        }
    });

});

module.exports = router;