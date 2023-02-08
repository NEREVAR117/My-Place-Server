// Written from mid September 2022 to early October 2022 to recreate r/place for me and friends
// Modified to support canvas HTML client on October 3rd, 2022 (was originally HTML elements)


import WebSocket, {WebSocketServer} from 'ws'
import fs from 'fs'


const wss = new WebSocketServer({maxPayload: 100, port: 12345})

let board_state = []
let board_state_timeline = []

const board_height = 500
const board_width = 500



// Read JSON object from board state file
fs.readFile('board_state.json', 'utf-8', (err, data) =>
{
  if(err)
  {
      throw err
  }

  // Parse JSON object
  board_state = JSON.parse(data.toString())
})

// Read JSON object from timeline file
fs.readFile('board_state_timeline.json', 'utf-8', (err, data) =>
{
  if(err)
  {
      throw err
  }

  // Parse JSON object
  board_state_timeline = JSON.parse(data.toString())
})









var id = 0;
var lookup = {};

// Triggers when a client connects
wss.on('connection', function connection(ws)
{
  console.log("A client connected.")

  ws.id = id++;
  lookup[ws.id] = ws;

  if (lookup[ws.id].readyState === WebSocket.OPEN)
  {
    lookup[ws.id].send(JSON.stringify({type: "board_state", board_state, width: board_width, height: board_height}))
  }



  // Triggers when the server gets sent a message (pixel update usually) from a client
  ws.on('message', function message(data)
  {
    // Catchs non-JSON input from the client
    let parsed_data = {}
    try
    {
      parsed_data = JSON.parse(data)
    }
    
    catch (error)
    {
      console.error(error)
    }

    //const parsed_data = JSON.parse(data)

    console.log("Data recieved")
    console.log(parsed_data)





    if(parsed_data.type === 'timeline_call')
    {

      if(lookup[ws.id].readyState === WebSocket.OPEN)
      {
        console.log("Timeline was called for by client")

        lookup[ws.id].send(JSON.stringify({type: "board_state_timeline", board_state_timeline}))
      }
    }







    // Checks and triggers only for pixel updates from clients (only if placed in the allowed canvas space)
    if(parsed_data.type === 'set_tile' && parsed_data.x < board_width && parsed_data.y < board_height)
    {
      console.log("IP is:", ws._socket.remoteAddress)

      console.log("Recieved pixel update from a client")

      var x = parsed_data.x
      var y = parsed_data.y
      var new_color = parsed_data.c

      console.log(parsed_data)


// CHECK IF RGB(XXX) AND MANIPULATE IT AS SO
      if(new_color.slice(0, 3) === 'rgb')
      {

        console.log("here")
        console.log(new_color)

        new_color = new_color.slice(4)
        console.log(new_color)
        new_color = new_color.slice(0, -1)



        console.log(new_color)

        let color_array = new_color.split(",")

        console.log(color_array)


        console.log("R is:", color_array[0])
        console.log(color_array[0].length)
        console.log(typeof(color_array[0]))

        let r = Number(color_array[0]).toString(16)
        let g = Number(color_array[1]).toString(16)
        let b = Number(color_array[2]).toString(16)

        console.log("R is:", r)
        
        if (r.length == 1)
            r = "0" + r
        if (g.length == 1)
            g = "0" + g
        if (b.length == 1)
            b = "0" + b
        
        new_color = "#" + r + g + b

        console.log("Current color is", new_color)
      }



      var x_result = (x - Math.floor(x)) !== 0
      var y_result = (y - Math.floor(y)) !== 0

      console.log(new_color)

      var reg_exp_color = /^#([0-9a-f]{3}){1,2}$/
      //console.log(reg_exp_color.test('#ABC')) //true
      //console.log(reg_exp_color.test('#AABBCC')) //true
      //console.log(reg_exp_color.test(new_color))
      
      // Checks if X and Y are valid and also 
      if (!x_result && !y_result && reg_exp_color.test(new_color))
      {
        console.log("Numbers are whole.")
        

        console.log(parsed_data)
        console.log(parsed_data.c)

        // Removes unneeded element in the object for storing to arrays and saving 
        delete parsed_data.type



        // Checks for existing element in the array that presents the pixel coordinates
        let coords_found = false
        for(let i = 0; i < board_state.length; i++)
        {
        // Triggers if an existing pixel is in this location with a DIFFERENT color
          if(x === board_state[i].x && y === board_state[i].y && new_color != board_state[i].c)
          {
            console.log("Reassigned an existing coordinate with a new color")
            board_state[i].c = new_color
            coords_found = true

            // Pushes into the timeline array (all colors accepted, even white)
            //console.log(parsed_data)
            board_state_timeline.push({...parsed_data})

            // Triggers if we're turning a pixel white (removes it from the board_state array)
            if(new_color === "#ffffff" || new_color === "#FFFFFF")
            {
              console.log("Placed white pixel, removing from array")
              board_state.splice(i, 1)
            }

            break
          }

          // Triggers if an existing pixel is in this location with the SAME color
          else if(x === board_state[i].x && y === board_state[i].y && new_color === board_state[i].c)
          {
            console.log("This coordinate is already this color")
            coords_found = true
            break
          }
        }

        // Triggers if no pre-existing pixels were found in the array at this location, places in a pixel at this location
        if(coords_found === false)
        {
          // Triggers if the client is placing a white pixel on a white canvas (aka does nothing)
          if(new_color === "#ffffff" || new_color === "#FFFFFF")
          {
            console.log("Trying to place white on an enpty pixel. Ignoring...")
          }

          // Triggers if a non-white color is used by the client, places a new pixel and color into the board_state array
          else
          {
            console.log("No existing coordinates, adding to pixel and color to array")
            board_state.push({...parsed_data})
            
            //console.log(parsed_data)
            // Pushes into the timeline array (all colors accepted except white)
            board_state_timeline.push({...parsed_data})
          }
        }


        // Sends the pixel update to every client
        wss.clients.forEach(client =>
        {
          if(client.readyState === WebSocket.OPEN)
          {
            console.log(new_color)
            client.send(JSON.stringify({type: "tile_set", x, y, new_color}))
          }
        })
      }

      // Only triggers if the webcksocket package has been sabotaged by the client
      else
      {
        if(lookup[ws.id].readyState === WebSocket.OPEN)
        {
          console.log("Malformed injection detected")

          //console.log("WS.id", ws.id)
          //console.log("lookup", lookup[ws.id])

          //wss.manager.onClientDisconnect(lookup[ws.id])
  
          lookup[ws.id].send(JSON.stringify({type: "malform_warning"}))

          ws.close()

          console.log(ws._socket.remoteAddress)




          let log_file = ''

          // Read text fil
          fs.readFile('log.txt', 'utf-8', (err, data) =>
          {
            if(err)
            {
                throw err
            }

            // Parse JSON object

            log_file = data

            // Okay Javascript why is this not built-in
            var objToday = new Date(),
              weekday = new Array('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
              dayOfWeek = weekday[objToday.getDay()],
              domEnder = function() { var a = objToday; if (/1/.test(parseInt((a + "").charAt(0)))) return "th"; a = parseInt((a + "").charAt(1)); return 1 === a ? "st" : 2 === a ? "nd" : 3 === a ? "rd" : "th" }(),
              dayOfMonth = today + ( objToday.getDate() < 10) ? '0' + objToday.getDate() + domEnder : objToday.getDate() + domEnder,
              months = new Array('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'),
              curMonth = months[objToday.getMonth()],
              curYear = objToday.getFullYear(),
              curHour = objToday.getHours() > 12 ? objToday.getHours() - 12 : (objToday.getHours() < 10 ? "0" + objToday.getHours() : objToday.getHours()),
              curMinute = objToday.getMinutes() < 10 ? "0" + objToday.getMinutes() : objToday.getMinutes(),
              curSeconds = objToday.getSeconds() < 10 ? "0" + objToday.getSeconds() : objToday.getSeconds(),
              curMeridiem = objToday.getHours() > 12 ? "PM" : "AM";
            var today = curMonth + " " + dayOfMonth + ", " + curYear + " at " + curHour + ":" + curMinute + "." + curSeconds + curMeridiem + " (" + dayOfWeek + ")"
            
            log_file = log_file.concat("IP Address: ", ws._socket.remoteAddress, " tried injecting malformed data over the websocket at ", today, "\n\n")

            fs.writeFile('log.txt', log_file, (err) =>
            {
                if(err)
                {
                    throw err
                }
                //console.log(board_state)
    
            })

          })

          // TRACK USER IP AND LOG TO NOTEPAD?
        }
      }




    }
  
  })

})

// Saves the board state every 60 seconds
setInterval(write_to_file, 60000)


function write_to_file()
{
  // convert JSON object to string
  const data = JSON.stringify(board_state)

  console.log("Trying to save...")

  // Write JSON board state string to a file
  fs.writeFile('board_state.json', data, (err) =>
  {
      if(err)
      {
          throw err
      }
      //console.log(board_state)
      console.log("JSON board data is saved.")
  })

  const data_timeline = JSON.stringify(board_state_timeline)
  // Write JSON timeline string to a file
  fs.writeFile('board_state_timeline.json', data_timeline, (err) =>
  {
      if(err)
      {
          throw err
      }
      //console.log(board_state)
      console.log("JSON timeline data is saved.")
  })
}