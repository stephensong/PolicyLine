"use strict";

let expect = require('chai').expect;
let Policy = require('../dist/policyline.min').Policy;

describe("Condition", function () {
    it(": mixins", function () {
        let rules = {
            effect: "permit"
        };

        let policy = new Policy(rules);
        let user = {firstName: 'John'};

        policy.check(user);
        let condition = policy.condition({lastName: 'Doe'});

        expect(condition).to.deep.own.include({
            user: {lastName: 'Doe', firstName: 'John'}
        });
    });

    it(": compile", function () {
        let rules = {
            effect: "permit",
            condition: [
                "resource.name='post'",
                "resource.location=user.location"
            ]
        };

        let policy = new Policy(rules);
        let user = {location: 'NY'};

        policy.check(user);
        let condition = policy.condition();

        expect(condition).to.deep.own.include({
            user: {location: 'NY'},
            condition: {
                name: 'post',
                location: 'NY'
            }
        });
    });

    it(": compile complex & inner rules", function () {
        let rules = {
            effect: "permit",
            condition: [
                "resource.$or=[{status:'A'},{qty:{$lt:30}}]"
            ]
        };

        let policy = new Policy(rules);
        let user = {location: 'NY'};

        policy.check(user);
        let condition = policy.condition().condition;

        expect(condition).to.deep.own.include({
            "$or": [
                {
                    "status": "A"
                },
                {
                    "qty": {
                        "$lt": 30
                    }
                }
            ]
        });
    });

    it(": compile complex & inner rules", function () {
        let rules = {
            effect: "permit",
            condition: [
                "resource.$or='A'",
                "resource.$or={status:'A'}",
                "resource.$or={status:'B'}",
                "resource.$or={qty:{$gt:30, $lt:50}}"
            ]
        };

        let policy = new Policy(rules);
        let user = {location: 'NY'};

        policy.check(user);
        let condition = policy.condition().condition;

        expect(condition).to.deep.own.include({
            "$or": [
                'A',
                {
                    "status": "A"
                },
                {
                    "status": "B"
                },
                {
                    "qty": {
                        "$gt": 30,
                        "$lt": 50
                    }
                }
            ]
        });
    });

    it(": compile operation", function () {
        let rules = {
            effect: "permit",
            condition: [
                "resource.name='post'",
                "resource.location=user.location",
                "resource.total>=(user.total*10)",
            ]
        };

        let policy = new Policy(rules);
        let user = {location: 'NY', total: 10};

        policy.check(user);
        let condition = policy.condition();

        expect(condition).to.deep.own.include({
            user: {
                location: 'NY',
                total: 10
            },
            condition: {
                name: 'post',
                location: 'NY',
                total: ['>=', 100]
            }
        });
    });

    it(": compile operation with resource values", function () {
        let rules = {
            effect: "permit",
            condition: [
                "resource.name='post'",
                "resource.location=user.location",
                "resource.limit>=(resource.total + user.operation)",
            ]
        };

        let policy = new Policy(rules);
        let user = {location: 'NY', operation: 10};
        let resource = {total: 120};

        policy.check(user, null, null, resource);
        let condition = policy.condition();

        // make transaction if (limit of resource)>=130 for all 'post' in 'NY'
        expect(condition).to.deep.own.include({
            user: {
                location: 'NY',
                operation: 10
            },
            resource: {total: 120},
            condition: {
                name: 'post',
                location: 'NY',
                limit: ['>=', 130],
                total: 120
            }
        });
    });

    it(": compile operation with inner resource object(mongoose like)", function () {
        let rules = {
            effect: "permit",
            condition: [
                "resource.occupation=/host/",
                "resource.age.$gt=17",
                "resource.age.$lt=66",
                "'name.last'='Ghost'",
                "resource.likes.$in=['vaporizing', 'talking']",
            ]
        };

        // mongoose 'find' object from 'http://mongoosejs.com/docs/queries.html'
        let result = {
            occupation: /host/,
            'name.last': 'Ghost',
            age: {$gt: 17, $lt: 66},
            likes: {$in: ['vaporizing', 'talking']}
        };

        let policy = new Policy(rules);
        policy.check();

        const condition = policy.condition().condition;

        expect(condition).to.deep.equal(result);
    });

    it(": condition in policies composition", function () {

        let rulesA = {
            effect: "permit",
            condition: [
                "resource.occupation=/host/gi",
                "resource.age.$gt=17"
            ]
        };

        let rulesB = {
            effect: "permit",
            condition: [
                "resource.age.$lt=66",
                "resource.likes.$in=['vaporizing', 'talking']",
            ]
        };

        let rulesC = {
            effect: "permit",
            condition: [
                "'name.last'='Ghost'"
            ]
        };

        // mongoose 'find' object from 'http://mongoosejs.com/docs/queries.html'
        let result = {
            occupation: /host/gi,
            'name.last': 'Ghost',
            age: {$gt: 17, $lt: 66},
            likes: {$in: ['vaporizing', 'talking']}
        };

        let policyA = new Policy(rulesA);
        let policyB = new Policy(rulesB);
        let policyC = new Policy(rulesC);
        let policy = policyA.and(policyB).and(policyC);
        policy.check();

        const condition = policy.condition().condition;

        expect(condition).to.deep.equal(result);
    });

    it(": group expression", function () {
        let policyGroup = { // all algorithms set in 'all' by default
            expression: '(user AND location)OR(admin OR super_admin)',
            policies: {
                user: {
                    effect: "permit",
                    condition: [
                        "resource.occupation=/host/",
                        "resource.age.$gt=17"
                    ]
                },
                location: {
                    effect: "permit",
                    condition: [
                        "resource.age.$lt=66",
                        "'name.last'='Ghost'",
                        "resource.likes.$in=['vaporizing', 'talking']",
                    ]
                },
                admin: {
                    target: [
                        "user.role='admin'"
                    ],
                    effect: "permit",
                    condition: [
                        "resource.test='test'"
                    ]
                },
                super_admin: {
                    target: [
                        "user.role='admin'"
                    ],
                    effect: "permit"
                }
            }
        };
        // mongoose 'find' object from 'http://mongoosejs.com/docs/queries.html'
        let result = {
            occupation: /host/,
            'name.last': 'Ghost',
            age: {$gt: 17, $lt: 66},
            likes: {$in: ['vaporizing', 'talking']}
        };

        let policy = new Policy(policyGroup);
        policy.check();

        const condition = policy.condition().condition;

        expect(condition).to.deep.equal(result);
    });
});