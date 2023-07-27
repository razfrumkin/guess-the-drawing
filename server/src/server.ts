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

type Users = { [id: string]: string }
const users: Users = {}

io.on('connection', (socket: Socket) => {
    console.log(`Socket ${socket.id} has connected`)

    socket.on('joined', (username: string) => {
        console.log(`Socket ${socket.id} has joined with the name "${username}"`)
        users[socket.id] = username
        socket.emit('welcome', users)
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
})