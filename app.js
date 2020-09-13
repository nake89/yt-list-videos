const axios = require("axios")
const prompts = require("prompts")
const Configstore = require("configstore")
const packageJson = require("./package.json")
const config = new Configstore(packageJson.name)
const {program} = require("commander")
program.version("0.0.1")
program.option("-k, --apikey", "Edit API key")
program.parse(process.argv)
;(async () => {
  const youtubeVideoPrefix = "https://www.youtube.com/watch?v="
  let apiKey
  if (!config.get("apiKey") || program.apikey) {
    const apiKeyQuestion = await prompts({
      type: "text",
      name: "value",
      message: "YouTube Data API key?"
    })

    apiKey = apiKeyQuestion.value
    if (!apiKey) {
      process.exit(0)
    }
    config.set("apiKey", apiKey)
  } else {
    apiKey = config.get("apiKey")
  }

  const ytAccountName = await prompts({
    type: "select",
    name: "value",
    message: "Channel ID or username?",
    choices: [
      {title: "Channel ID", value: "channelID"},
      {title: "Username", value: "username"}
    ],
    initial: 0
  })
  if (!ytAccountName.value) {
    process.exit(0)
  }
  let channelIdOrUsername = ytAccountName.value
  const getIdentifier = await prompts({
    type: "text",
    name: "value",
    message: `What is the ${channelIdOrUsername}?`
  })
  if (!getIdentifier.value) {
    process.exit(0)
  }
  const identifier = getIdentifier.value

  try {
    let channelId
    if (channelIdOrUsername != "channelID") {
      const getUserData = await axios.get(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forUsername=${identifier}&key=${apiKey}`
      )
      channelId = getUserData.data.items[0].id
    } else {
      channelId = identifier
    }

    const getPlaylists = await axios.get(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=50&key=${apiKey}`
    )

    let choices = []
    for (let item of getPlaylists.data.items) {
      let choice = {
        title: item.snippet.title,
        value: item.id
      }
      choices.push(choice)
    }

    const response = await prompts({
      type: "select",
      name: "value",
      message: "List of playlists",
      choices,
      initial: 0
    })

    const playlistId = response.value
    if (!playlistId) {
      process.exit(0)
    }
    const getPlaylistData = await axios.get(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet%2CcontentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}`
    )

    for (item of getPlaylistData.data.items) {
      console.log(youtubeVideoPrefix + item.contentDetails.videoId)
    }

    const pageInfo = getPlaylistData.data.pageInfo
    const pages = Math.ceil(pageInfo.totalResults / pageInfo.resultsPerPage)
    if (pages > 1) {
      let nextPageToken = getPlaylistData.data.nextPageToken
      while (nextPageToken) {
        let nextPageData = await axios.get(
          `https://www.googleapis.com/youtube/v3/playlistItems?pageToken=${nextPageToken}&part=snippet%2CcontentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}`
        )
        if (nextPageData.data.nextPageToken) {
          nextPageToken = nextPageData.data.nextPageToken
        } else {
          nextPageToken = null
        }
        for (item of nextPageData.data.items) {
          console.log(youtubeVideoPrefix + item.contentDetails.videoId)
        }
      }
    }
  } catch (e) {
    console.log(e)
  }
})()
