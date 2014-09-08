# Description
#   A Hubot script that DESCRIPTION
#
# Dependencies:
#   "form-data": "^0.1.4",
#   "hubot-arm": "^0.2.1",
#   "hubot-request-arm": "^0.2.1",
#   "q": "^1.0.1",
#   "request": "^2.42.0"
#
# Configuration:
#   HUBOT_BACKLOG_BURNDOWNCHART_SPACE_ID
#   HUBOT_BACKLOG_BURNDOWNCHART_USERNAME
#   HUBOT_BACKLOG_BURNDOWNCHART_PASSWORD
#   HUBOT_BACKLOG_BURNDOWNCHART_API_KEY
#   HUBOT_BACKLOG_BURNDOWNCHART_SLACK_TOKEN
#
# Commands:
#   hubot backlog burndownchart <P> <M> - display the backlog burn down chart
#
# Author:
#   bouzuya <m@bouzuya.net>
#
module.exports = (robot) ->
  require('hubot-arm') robot

  SPACE_ID = process.env.HUBOT_BACKLOG_BURNDOWNCHART_SPACE_ID
  USERNAME = process.env.HUBOT_BACKLOG_BURNDOWNCHART_USERNAME
  PASSWORD = process.env.HUBOT_BACKLOG_BURNDOWNCHART_PASSWORD
  API_KEY = process.env.HUBOT_BACKLOG_BURNDOWNCHART_API_KEY
  SLACK_TOKEN = process.env.HUBOT_BACKLOG_BURNDOWNCHART_SLACK_TOKEN

  BASE_URL = "https://#{SPACE_ID}.backlog.jp"

  getBurnDownChart = (milestoneId) ->
    robot.arm('request')
      method: 'POST'
      url: BASE_URL + '/Login.action'
      form:
        url: ''
        userId: USERNAME
        password: PASSWORD
    .then (res) ->
      cookies = res.headers['set-cookie']
      sessionId = cookies.filter((i) -> i.match /^JSESSIONID=/)[0]
      robot.arm('request')
        method: 'GET'
        headers:
          cookie: sessionId
        url: BASE_URL + '/BurndownChartSmall.action'
        qs:
          milestoneId: milestoneId
        encoding: 'binary'
    .then (res) ->
      res.body

  getMilestones = (projectKey) ->
    robot.arm('request')
      method: 'GET'
      url: BASE_URL + '/api/v2/projects/' + projectKey + '/versions'
      qs:
        apiKey: API_KEY
      format: 'json'

  getMilestone = (projectKey, milestoneName) ->
    getMilestones(projectKey)
      .then (res) ->
        milestones = res.json
        milestones.filter((m) ->
          m.name.toLowerCase() is milestoneName.toLowerCase()
        )[0]

  uploadToSlack = (projectKey, milestoneName, image, channel) ->
    fs = require 'fs'
    mkdirp = require 'mkdirp'
    request = require 'request'
    {Promise} = require 'q'
    new Promise (resolve, reject) ->
      dir = './hubot-backlog-burndownchart' + '/' + projectKey
      path = dir + '/' + milestoneName + '.png'
      promise = if fs.existsSync(dir)
        Promise.resolve()
      else
        new Promise (resolve, reject) ->
          mkdirp dir, (err) ->
            return reject(err) if err?
            resolve()
      promise
        .then ->
          fs.writeFileSync(path, image, { encoding: 'binary' })
          url = 'https://slack.com/api/files.upload'
          r = request.post url, (err, httpResponse, body) ->
            return reject(err) if err?
            resolve()
          form = r.form()
          form.append('file', fs.createReadStream(path))
          form.append('token', SLACK_TOKEN)
          form.append('channels', channel)
        .then null, (e) ->
          reject(e)

  robot.respond /backlog\s+burn(?:downchart)?\s+(\S+)\s+(\S+)$/i, (res) ->
    projectKey = res.match[1]
    milestoneName = res.match[2]
    getMilestone(projectKey, milestoneName)
      .then (milestone) ->
        return unless milestone?
        getBurnDownChart(milestone.id)
      .then (image) ->
        uploadToSlack(projectKey, milestoneName, image, res.envelope.room)
