import p5 from 'p5'
import { Socket } from 'socket.io-client'


type Users = { [id: string]: string}

export class Game {
    private socket: Socket
    private users: Users

    constructor(socket: Socket, username: string) {
        this.socket = socket
        this.users = {}

        this.socket.emit('joined', username)
        this.activateSocketEvents()

        const container = document.getElementById('container') as HTMLDivElement

        const activateSketch = (sketch: p5) => {
            sketch.setup = () => {
                const renderer = sketch.createCanvas(800, 800)
                container.insertAdjacentElement('afterbegin', renderer.elt)
                sketch.frameRate(60)
            }

            sketch.draw = () => {
                this.input(sketch)
                this.update(sketch)
                this.render(sketch)
            }
        }

        new p5(activateSketch)
    }

    private activateSocketEvents() {
        this.socket.on('user-joined', (id: string, username: string) => {
            if (this.socket.id === id) return
            this.users[id] = username
        })

        this.socket.on('user-left', (id: string) => {
            delete this.users[id]
        })

        this.socket.on('welcome', (users: Users) => {
            this.users = users
        })
    }

    private input(sketch: p5) {

    }

    private update(sketch: p5) {

    }

    private render(sketch: p5) {
        sketch.background(50)
        sketch.fill(200)
        sketch.textAlign('left')
        let y = 50
        for (const id in this.users) {
            y += 50
            sketch.textSize(32)
            sketch.text(this.users[id], 50, y)
        }
    }
}