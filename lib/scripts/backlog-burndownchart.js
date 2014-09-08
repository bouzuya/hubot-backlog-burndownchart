// Description
//   A Hubot script that DESCRIPTION
//
// Dependencies:
//   "form-data": "^0.1.4",
//   "hubot-arm": "^0.2.1",
//   "hubot-request-arm": "^0.2.1",
//   "q": "^1.0.1",
//   "request": "^2.42.0"
//
// Configuration:
//   HUBOT_BACKLOG_BURNDOWNCHART_SPACE_ID
//   HUBOT_BACKLOG_BURNDOWNCHART_USERNAME
//   HUBOT_BACKLOG_BURNDOWNCHART_PASSWORD
//   HUBOT_BACKLOG_BURNDOWNCHART_API_KEY
//   HUBOT_BACKLOG_BURNDOWNCHART_SLACK_TOKEN
//
// Commands:
//   hubot backlog burndownchart <P> <M> - display the backlog burn down chart
//
// Author:
//   bouzuya <m@bouzuya.net>
//
module.exports = function(robot) {
  var API_KEY, BASE_URL, PASSWORD, SLACK_TOKEN, SPACE_ID, USERNAME, getBurnDownChart, getMilestone, getMilestones, uploadToSlack;
  require('hubot-arm')(robot);
  SPACE_ID = process.env.HUBOT_BACKLOG_BURNDOWNCHART_SPACE_ID;
  USERNAME = process.env.HUBOT_BACKLOG_BURNDOWNCHART_USERNAME;
  PASSWORD = process.env.HUBOT_BACKLOG_BURNDOWNCHART_PASSWORD;
  API_KEY = process.env.HUBOT_BACKLOG_BURNDOWNCHART_API_KEY;
  SLACK_TOKEN = process.env.HUBOT_BACKLOG_BURNDOWNCHART_SLACK_TOKEN;
  BASE_URL = "https://" + SPACE_ID + ".backlog.jp";
  getBurnDownChart = function(milestoneId) {
    return robot.arm('request')({
      method: 'POST',
      url: BASE_URL + '/Login.action',
      form: {
        url: '',
        userId: USERNAME,
        password: PASSWORD
      }
    }).then(function(res) {
      var cookies, sessionId;
      cookies = res.headers['set-cookie'];
      sessionId = cookies.filter(function(i) {
        return i.match(/^JSESSIONID=/);
      })[0];
      return robot.arm('request')({
        method: 'GET',
        headers: {
          cookie: sessionId
        },
        url: BASE_URL + '/BurndownChartSmall.action',
        qs: {
          milestoneId: milestoneId
        },
        encoding: 'binary'
      });
    }).then(function(res) {
      return res.body;
    });
  };
  getMilestones = function(projectKey) {
    return robot.arm('request')({
      method: 'GET',
      url: BASE_URL + '/api/v2/projects/' + projectKey + '/versions',
      qs: {
        apiKey: API_KEY
      },
      format: 'json'
    });
  };
  getMilestone = function(projectKey, milestoneName) {
    return getMilestones(projectKey).then(function(res) {
      var milestones;
      milestones = res.json;
      return milestones.filter(function(m) {
        return m.name.toLowerCase() === milestoneName.toLowerCase();
      })[0];
    });
  };
  uploadToSlack = function(projectKey, milestoneName, image, channel) {
    var Promise, fs, mkdirp, request;
    fs = require('fs');
    mkdirp = require('mkdirp');
    request = require('request');
    Promise = require('q').Promise;
    return new Promise(function(resolve, reject) {
      var dir, path, promise;
      dir = './hubot-backlog-burndownchart' + '/' + projectKey;
      path = dir + '/' + milestoneName + '.png';
      promise = fs.existsSync(dir) ? Promise.resolve() : new Promise(function(resolve, reject) {
        return mkdirp(dir, function(err) {
          if (err != null) {
            return reject(err);
          }
          return resolve();
        });
      });
      return promise.then(function() {
        var form, r, url;
        fs.writeFileSync(path, image, {
          encoding: 'binary'
        });
        url = 'https://slack.com/api/files.upload';
        r = request.post(url, function(err, httpResponse, body) {
          if (err != null) {
            return reject(err);
          }
          return resolve();
        });
        form = r.form();
        form.append('file', fs.createReadStream(path));
        form.append('token', SLACK_TOKEN);
        return form.append('channels', channel);
      }).then(null, function(e) {
        return reject(e);
      });
    });
  };
  return robot.respond(/backlog\s+burn(?:downchart)?\s+(\S+)\s+(\S+)$/i, function(res) {
    var milestoneName, projectKey;
    projectKey = res.match[1];
    milestoneName = res.match[2];
    return getMilestone(projectKey, milestoneName).then(function(milestone) {
      if (milestone == null) {
        return;
      }
      return getBurnDownChart(milestone.id);
    }).then(function(image) {
      return uploadToSlack(projectKey, milestoneName, image, res.envelope.room);
    });
  });
};
