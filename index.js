const Promise = require('bluebird');
const axios = require('axios');
const fs = require('fs');
const xml2js = require('xml2js');
const json2csv = require('json2csv');
const config = require('./config.js');

const csvHeaders = ["object", "id", "name" ];
let standardFields = [],
    profileFields = [],
    addressFields = [],
    altAddressFields = [],
    regQuestionFields = [];

function getAttendees() {
    return axios({
        url: `https://${config.baseURL}/certainExternal/service/v1/Registration/${config.accountCode}/${config.eventCode}?include_list=profile_questions,groups,registration_questions,travel_questions,financial,assistant,additional`,
        method: 'get',
        auth: {
            username : config.username,
            password: config.password
        },
        headers: {
            'Accept' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
    });
}

function saveData(response) {
    return new Promise((resolve, reject) => {
        fs.writeFile('./xml/attendees.xml', response.data, (err) => {
            if (err) {
                reject(err);
            }
            resolve(response.data);
        });
    });
}

function parseXml(xmlStr) {
    return new Promise((resolve, reject) => {
        xml2js.parseString(xmlStr, (err, result) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        });
    });
}

function pickSingleAttendee(regObj) {
    return new Promise((resolve, reject) => {
        resolve(regObj.collection.registrations[0].registration[0]);
    });
}

function pushStandardFields(reg) {
    return new Promise((resolve, reject) => {            
        for(let p in reg) {
            if (reg.hasOwnProperty(p)) {
                if (p !== 'profile' && p !== 'registrationQuestions' && p !== 'travelQuestions' && p !== 'properties' && p !== 'groups') {
                    standardFields.push({
                        object: 'standard',
                        id : p,
                        name : ''
                    });
                }
            }
        }
        standardFields.push({object: '', id: '', name: ''});
        resolve(reg);
    });
}

function pushOtherFields(reg) {
    return new Promise((resolve, reject) => {
        for (let p in reg) {
            if (reg.hasOwnProperty(p)) {
                if ( p === 'profile' ) {
                    extractProfileNames(reg[p][0]);
                } else if ( p === 'registrationQuestions') {
                    extractRegistrationQuestions(reg[p][0].question)
                } else if ( p === 'travelQuestions') {
                    // Not implemented
                } else if ( p === 'properties') {
                    // Not implemented
                } else if ( p === 'groups') {
                    // Not implemented
                }
                // Profile Questions??
            }
        }
        let newCsv = standardFields.concat(profileFields, addressFields, altAddressFields, regQuestionFields);
        resolve(newCsv);
    });
}

function extractRegistrationQuestions(obj) {
    obj.forEach((question) => {
        regQuestionFields.push({
            object : 'registrationQuestions (regQ_)',
            id : question.questionId[0],
            name : question.questionName[0]
        });
    });
    
    if(regQuestionFields.length > 0) {
        regQuestionFields.push({object : '', id: "", name: ""});
    }
}

function extractProfileNames(obj) {    
    for (let prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            if (prop !== 'assistant' && prop !== 'additional' && prop !== 'address' && prop !== 'altAddress') {
                profileFields.push({
                    object: 'profile',
                    id : prop,
                    name : ''
                })
            } else if (prop === 'address') {
                extractAddressNames(obj[prop][0]);
            } else if (prop === 'altAddress') {
                extractAltAddressNames(obj[prop][0]);
            } else if (prop === 'additional') {
                // Not implemented
            } else if (prop === 'assistant') {
                // Not implemented
            }            
        }
    }

    if(profileFields.length > 0) {
        profileFields.push({object : '', id: "", name: ""});
    }
}

function extractAddressNames(obj) {
    for (let prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            addressFields.push({
                object: 'address (address_)',
                id: prop,
                name: ''
            });
        }
    }
    if(addressFields.length > 0) {
        addressFields.push({object : '', id: "", name: ""});
    }
}

function extractAltAddressNames(obj) {
    for (let prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            altAddressFields.push({
                object: 'altAddress (altAddress_)',
                id: prop,
                name: ''
            });
        }
    }

    if(altAddressFields.length > 0) {
        altAddressFields.push({object : '', id: "", name: ""});
    }
}


function convertToCsv(csvAll) {
    return new Promise((resolve, reject) => {
        const csv = json2csv({ data: csvAll, fields: csvHeaders });
        resolve(csv);
    });
}

function writeCsv(csvStr) {
    return new Promise((resolve, reject) => {
        fs.writeFile('certain_questions.csv', csvStr, (err) => {
            if (err) {
                reject(err);
            }
            console.log("Done saving!");
            resolve();
        });
    });
}

function handleErrors(err) {
    if (err.response) {
        console.log(err.response.data);
        console.log(err.response.status);
        console.log(err.response.headers);
    } else {
        console.log('Error', err.message);
    }
}

getAttendees()
.then(saveData)
.then(parseXml)
.then(pickSingleAttendee)
.then(pushStandardFields)
.then(pushOtherFields)
.then(convertToCsv)
.then(writeCsv)
.catch(handleErrors);