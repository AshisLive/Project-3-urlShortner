const validUrl = require('valid-url');
const shortid = require('shortid')
const urlModel = require('../models/urlModel')

const redis = require("redis");
const { promisify } = require("util")

const redisClient = redis.createClient(
    17025,
    "redis-17025.c264.ap-south-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("mQLwes7omJdyMTuMVm6Ah5sX4BByn5ZF", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});


const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const SETEX_ASYNC = promisify(redisClient.SETEX).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);

const isValid = function (value) {
    if (typeof (value) === 'undefined' || typeof (value) === 'null') { return false } //if undefined or null occur rather than what we are expecting than this particular feild will be false.
    if (value.trim().length == 0) { return false } //if user give spaces not any string eg:- "  " =>here this value is empty, only space is there so after trim if it becomes empty than false will be given. 
    if (typeof (value) === 'string' && value.trim().length > 0) { return true } //to check only string is comming and after trim value should be their than only it will be true.
}

const isValidRequestBody = function (requestBody) {
    return Object.keys(requestBody).length > 0
}

const createurl = async function (req, res) {

    try {
        if (!isValidRequestBody(req.body)) {
            res.status(400).send({ status: false, message: 'Invalid request parameters. Please provide URL details' })
            return
        }
        if (!isValid(req.body.longUrl)) {
            return res.status(400).send({ status: false, message: ' Please provide LONG URL' })
        }

        const longUrl = req.body.longUrl.trim()

        if (!(validUrl.isUri(longUrl))) {
            return res.status(400).send({ status: false, msg: "longurl is not valid" })
        }

        const baseUrl = 'http://localhost:3000'
        //---GENERATE URLCODE
        let urlCode = shortid.generate().match(/[a-z\A-Z]/g).join("") //---this will give only Alphabet
        urlCode = urlCode.toLowerCase()     //now urlcode is->lowercase only no->no.'s ,or char, or uppercase
        //---FETCH THE DATA IN REDIS
        let checkforUrl = await GET_ASYNC(`${longUrl}`)
        if (checkforUrl) {
            console.log("line no66")
            return res.status(200).send({ status: true, "data": JSON.parse(checkforUrl) })
        }
        //---FETCH THE DATA IN MONGO DB IF IT IS NOT PRESENT IN CACHE
        let url = await urlModel.findOne({ longUrl })
        if (url) {
            return res.status(200).send({ status: true, "data": url }) //---if already exist
        }

        //---GENERATE DATA BY LONG URL
        const shortUrl = baseUrl + '/' + urlCode
        const urlData = { urlCode, longUrl, shortUrl }
        const newurl = await urlModel.create(urlData);
        //---SET GENERATE DATA IN CACHE
        await SET_ASYNC(`${longUrl}`, JSON.stringify(urlData))
        return res.status(201).send({ status: true, msg: `URL created successfully`, data: newurl });
    } catch (err) {
        console.log(err)
        res.status(500).send({ status: false, msg: 'Server Error' })
    }
}


const geturl = async function (req, res) {
    try {
        const urlCode = req.params.urlCode.trim().toLowerCase()
        if (!isValid(urlCode)) {
            res.status(400).send({ status: false, message: 'Please provide valid urlCode' })
        }

        let checkforUrl = await GET_ASYNC(`${urlCode}`)    //first check in cache
        if (checkforUrl) {
            return res.redirect(302, checkforUrl)
        }

        const url = await urlModel.findOne({ urlCode: urlCode })     //second check in Db
        if (!url) {
            return res.status(404).send({ status: false, message: 'No URL Found' })
        }
        await SET_ASYNC(`${urlCode}`, JSON.stringify(url.longUrl))     //if data found in db than created in cache
        return res.redirect(302, url.longUrl)

    } catch (err) {
        console.error(err)
        res.status(500).send('Server Error')
    }
}


module.exports.createurl = createurl
module.exports.geturl = geturl