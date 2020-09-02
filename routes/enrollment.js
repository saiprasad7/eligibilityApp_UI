const express = require("express");
let router = express.Router();
const axios = require("axios").default;
const url = require("url");
const { POLICY_SERVICE_URL, ENROLLMENT_SERVICE_URL } = require("../helpers/constants");
const logger = require("../helpers/logger");
const { format } = require("path");

router.get("/", function (req, res, next) {
    // Request policy data from Spring
    logger.debug("Requested enrollment page");
    return axios.get(POLICY_SERVICE_URL)
        .then(function (response) {
            logger.info("Requesting policy information from url: " + POLICY_SERVICE_URL);
            let data = {};
            data.policies = [];
            for (let item of response.data) {
                let value = {};
                value.policyName = item.policyName;
                value.policyId = item.policyId;
                data.policies.push(value);
            }
            // Extract success information from the query
            data.enrollMessage = req.query.success ? req.query.success : "";
            data.failedEnrollMessage = req.query.failure ? req.query.failure : "";
            logger.debug("Response information");
            logger.debug(response);
            logger.debug("Enrollment page rendering");
            logger.debug(data);
            return res.render("enrollment/index.ejs", { data: data });
        });
});

function getSubscriber(req, benefits, dependents) {
    let name = {
        firstName: req.body.firstname,
        lastName: req.body.lastname
    };
    var address = {
        street: req.body.street,
        city: req.body.city,
        state: req.body.state,
        country: req.body.country
    };

    return {
        subscriberId: req.body.subscriberId,
        name: name,
        address: address,
        email: req.body.email,
        password: req.body.password,
        dateOfBirth: req.body.dateofbirth,
        benefits: formatArray(benefits),
        dependents: formatArray(dependents)
    };
}

function formatArray(object) {
    return Array.isArray(object) ? object : [object];
}

function getDependents(req, benefits) {
    // TODO: Change for mulitple dependents
    var dependentName = {
        firstName: req.body.dependentfirstname,
        lastName: req.body.dependentlastname
    };
    var dependentAddress = {
        street: req.body.dependentstreet,
        city: req.body.dependentcity,
        state: req.body.dependentstate,
        country: req.body.dependentcountry
    };

    return {
        dependentId: req.body.dependentId,
        dependentName: dependentName,
        dependentAddress: dependentAddress,
        dependentDateOfBirth: req.body.dependentdateofbirth,
        dependentBenefits: formatArray(benefits)
    };
}

function extractRelevantBenefits(selectedBenefits, allBenefits) {
    // Filter allBenefits based on IDs returned from selectedBenefits
    // [1] = selected, allBenefits = [{policyId: 1, policyName: "1"}, {polciyId: 2, policyName: "2"}]
    // Returns => [{policyId: 1, policyName: "1"}]
    return allBenefits.filter(benefit => selectedBenefits.includes(benefit.policyId));
}

router.post("/", function (req, res, next) {
    logger.info("Requesting Policies from: " + POLICY_SERVICE_URL);
    return axios.get(POLICY_SERVICE_URL).then(function (response) {
        // Extract the selected policy information
        let benefits = extractRelevantBenefits(formatArray(req.body.policy), formatArray(response.data));
        let dependents = getDependents(req, benefits);
        let subscribers = getSubscriber(req, benefits, dependents);

        logger.info("Creating subscriber with ID: " + subscribers.subscriberId);
        logger.info("Endpoint: " + ENROLLMENT_SERVICE_URL);
        return axios({
            method: 'POST',
            url: ENROLLMENT_SERVICE_URL,
            data: subscribers
        }).then((enrollmentResponse) => {
            logger.info("Response status: " + enrollmentResponse.status);
            let message = enrollmentResponse.data ? "success" : "failure";
            let redirectUrl = url.format({
                pathname: "/enrollment",
                query: {
                    success: message
                }
            });
            return res.redirect(redirectUrl);
        }).catch((error) => {
            logger.error(error);
            return res.redirect(getEnrollmentRedirectMessage());
        });

    });
});

function getEnrollmentRedirectMessage(message = "Something went wrong") {
    return url.format({
        pathname: "/enrollment",
        query: {
            failure: message
        }
    });
}

module.exports = router;