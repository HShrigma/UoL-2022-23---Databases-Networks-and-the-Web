//#region TEMPLATE
/**
 * These are example routes for user management
 * This shows how to correctly structure your routes for the project
 */

const express = require("express");
const router = express.Router();
const assert = require("assert");
const { randomInt } = require("crypto");
const { urlencoded } = require("express");
const { check, validationResult } = require('express-validator');
const e = require("express");
const { exists } = require("fs");
let objId = 0;

const errMain = "ERROR READING MAINDATA";
const errArticles = "ERROR READING ARTICLES";
const errComments = "ERROR READING COMMENTS";
const sqlMain = "SELECT * FROM mainData";

/**
 * @desc retrieves the current users
 */
router.get("/get-test-users", (req, res, next) => {

  //Use this pattern to retrieve data
  //NB. it's better NOT to use arrow functions for callbacks with this library
  global.db.all("SELECT * FROM testUsers", function (err, rows) {
    if (err) {
      next(err); //send the error on to the error handler
    } else {
      res.json(rows);
    }
  });

});

/**
 * @desc retrieves the current user records
 */
router.get("/get-articles", (req, res, next) => {
  //USE this pattern to retrieve data
  //NB. it's better NOT to use arrow functions for callbacks with this library

  global.db.all("SELECT * FROM articles WHERE article_type='article';", function (err, rows) {
    console.log(rows);
    if (err) {
      next(err); //send the error on to the error handler
    } else {
      res.json(rows);
    }
  });
});
/**
 * @desc Renders the page for creating a user record
 */
router.get("/create-user-record", (req, res) => {
  res.render("create-user-record");
});

/**
 * @desc Add a new user record to the database for user id = 1
 */
router.post("/create-user-record", (req, res, next) => {
  //USE this pattern to update and insert data
  //NB. it's better NOT to use arrow functions for callbacks with this library
  const data = generateRandomData(10);
  global.db.run(
    "INSERT INTO testUserRecords ('test_record_value', 'test_user_id') VALUES( ?, ? );",
    [data, 1],
    function (err) {
      if (err) {
        next(err); //send the error on to the error handler
      } else {
        res.send(`New data inserted @ id ${this.lastID}!`);
        next();
      }
    }
  );
});



router.get("/", (req, res, next) => {
  //get title, sub, auth
  global.db.all("SELECT * FROM mainData", function (err, rows) {
    if (err) {
      console.log(errMain);
      next(err);
    } else {
      let title = rows[0].mainData_title;
      let subtitle = rows[0].mainData_subtitle;
      let author = rows[0].mainData_author;
      global.db.all("SELECT * FROM articles WHERE article_type='article';", function (err, rows) {
        if (err) {
          console.log(errArticles);
          next(err);
        } else {
          let articleRows = rows;
          res.render("indexReader", {
            title: title,
            subtitle: subtitle,
            author: author,
            rows: articleRows
          });
        }
      });
    }
  });


});

router.get("/article", (req, res,next) => {
  const sqlComments = "SELECT * FROM comments WHERE comments_articleid = " + req.query.id;
  const sqlArticle = "SELECT * FROM articles WHERE article_id = " + req.query.id;

  //update likes
  if (req.query.like == '1') {
    const updateLikesQuery = "UPDATE articles SET article_likes = article_likes + 1 WHERE article_id = " + req.query.id;
    global.db.run(updateLikesQuery, function (err) {
      if (err) {
        console.log("ERROR UPDATING LIKES");
        next(err);
      }
    });
  }
  global.db.all(sqlComments, function (err, rows) {
    if (err) {
      console.log(errComments);
      next(err);
    }
    else {
      let comments = rows;
      global.db.all(sqlMain, function (err, rows) {
        if (err) {
          console.log(errMain);
          next(err);
        }
        else {
          let author = rows[0].mainData_author;
          global.db.all(sqlArticle, function (err, rows) {
            if (err) {
              console.log(errArticles);
              next(err);
            }
            else {
              let article = rows[0];

              res.render("articleReader", {
                title: article.article_title,
                subtitle: article.article_subtitle,
                author: author,
                article: article,
                comments: comments,
                msg: ""
              });
            }
          });
        }
      });
    }
  });


});
router.post("/article",
  [check('userComment', 'Comment cannot be empty!').exists().trim().escape().notEmpty()
  ], (req, res,next) => {
    const sqlComments = "SELECT * FROM comments WHERE comments_articleid = " + req.body.id;
    const sqlArticle = "SELECT * FROM articles WHERE article_id = " + req.body.id;

    global.db.all(sqlComments, function (err, rows) {
      if (err) {
        console.log(errComments + "articleID: " + req.body.id);
        next(err);
      }
      else {
        let comments = rows;
        global.db.all(sqlMain, function (err, rows) {
          if (err) {
            console.log(errMain);
            next(err);
          }
          else {
            let author = rows[0].mainData_author;
            global.db.all(sqlArticle, function (err, rows) {
              if (err) {
                console.log(errArticles);
                next(err);
              }
              else {
                let article = rows[0];
                if (validationResult(req).array() != 0) {
                  res.render("articleReader", {
                    title: article.article_title,
                    subtitle: article.article_subtitle,
                    author: author,
                    article: article,
                    comments: comments,
                    msg: validationResult(req).array(req)[0].msg
                  });
                }
                else{
                  global.db.run("INSERT INTO comments ('comments_articleid', 'comments_text') VALUES( ?, ? );",
                  [req.body.id, req.body.userComment],function (err) {
                    if (err) {
                      console.log("ERROR UPDATING COMMENTS");
                      next(err);
                    }
                  });
                  comments.push({comments_articleid: req.body.id, comments_text: req.body.userComment});
                  res.render("articleReader", {
                    title: article.article_title,
                    subtitle: article.article_subtitle,
                    author: author,
                    article: article,
                    comments: comments,
                    msg: ""
                  });
                }
                
              }
            });
          }
        });
      }
    });
  });
///////////////////////////////////////////// HELPERS ///////////////////////////////////////////
//#region helpers
/**
 * @desc A helper function to generate a random string
 * @returns a random lorem ipsum string
 */
function dateToStrPretty() {
  let date = new Date();
  return date.getDate() + "/ " + (date.getMonth() + 1) + "/ " + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
}
function generateRandomData(numWords = 5) {
  const str =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum";

  const words = str.split(" ");

  let output = "";

  for (let i = 0; i < numWords; i++) {
    output += choose(words);
    if (i < numWords - 1) {
      output += " ";
    }
  }

  return output;
}
/**
 * @desc choose and return an item from an array
 * @returns the item
 */
function choose(array) {
  assert(Array.isArray(array), "Not an array");
  const i = Math.floor(Math.random() * array.length);
  return array[i];
}
//#endregion
module.exports = router;
//#endregion