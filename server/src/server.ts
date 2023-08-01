import path from 'path'
import http from 'http'
import express from 'express'
import { Server, Socket } from 'socket.io'

const publicPath = path.join(__dirname, '../../client/dist')
const port = process.env.PORT ?? 3000

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.static(publicPath))
app.get('/', (request, response) => {
    response.sendFile(path.join(publicPath, 'index.html'))
})

server.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})

type Settings = {
    canvasWidth: number
    canvasHeight: number 
    weightSliderMinimum: number
    weightSliderMaximum: number
    weightSliderDefault: number
}

type UserCollection = { [id: string]: string }

type Vector2D = { x: number, y: number }
type RGB = { red: number, green: number, blue: number }
type DrawingInstruction = {
    path: Vector2D[]
    color: RGB
    weight: number
}

const settings: Settings = {
    canvasWidth: 700,
    canvasHeight: 700,
    weightSliderMinimum: 1,
    weightSliderMaximum: 100,
    weightSliderDefault: 10
}

const users: UserCollection = {}

let drawingInstructions: DrawingInstruction[] = []

io.on('connection', (socket: Socket) => {
    console.log(`Socket ${socket.id} has connected`)

    socket.on('joined', (username: string) => {
        console.log(`Socket ${socket.id} has joined with the username "${username}"`)
        users[socket.id] = username
        socket.emit('welcome', settings, users, drawingInstructions)
        io.emit('user-joined', socket.id, username)
    })

    socket.on('disconnect', () => {
        console.log(`Socket ${socket.id} has disconnected`)
        if (socket.id in users) {
            console.log(`"${users[socket.id]}" has left`)
            delete users[socket.id]
            io.emit('user-left', socket.id)
        }
    })

    socket.on('new-path', (position: Vector2D, color: RGB, weight: number) => {
        if (!isInsideCanvas(position)) return

        const instruction = {
            path: [position],
            color: color,
            weight: constrain(weight, settings.weightSliderMinimum, settings.weightSliderMaximum)
        }

        drawingInstructions.push(instruction)
        socket.broadcast.emit('new-path', position, color, instruction.weight)
    })
    
    socket.on('drawing-position', (position: Vector2D) => {
        if (!isInsideCanvas(position)) return

        if (drawingInstructions.length === 0) return
        const instruction = drawingInstructions[drawingInstructions.length - 1]
        if (instruction.path.length === 0) return
        instruction.path.push(position)
        socket.broadcast.emit('drawing-position', position)
    })

    socket.on('reset', () => {
        drawingInstructions = []

        socket.broadcast.emit('reset')
    })

    socket.on('undo', () => {
        if (drawingInstructions.length === 0) return
        drawingInstructions.pop()

        socket.broadcast.emit('undo')
    })
})

function isInsideCanvas(position: Vector2D): boolean {
    return position.x >= 0 &&
           position.x <= settings.canvasWidth &&
           position.y >= 0 &&
           position.y <= settings.canvasHeight
}

function constrain(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum)
}