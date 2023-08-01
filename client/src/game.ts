import p5 from 'p5'
import { socket } from './join'

const container = document.getElementById('container') as HTMLDivElement
const undoButton = document.getElementById('undo-button') as HTMLButtonElement
const weightSlider = document.getElementById('weight-slider') as HTMLInputElement
const weightSpan = document.getElementById('weight-span') as HTMLSpanElement
const chat = document.getElementById('chat') as HTMLDivElement

type Settings = {
    canvasWidth: number
    canvasHeight: number 
    weightSliderMinimum: number
    weightSliderMaximum: number
    weightSliderDefault: number
}

type UserCollection = { [id: string]: string }

type Vector2D = { x: number, y: number }
type RGBA = { red: number, green: number, blue: number, alpha: number }
type DrawingInstruction = {
    path: Vector2D[]
    color: RGBA
    weight: number
}

let settings: Settings

let users: UserCollection

let drawingInstructions: DrawingInstruction[] = []
let path: Vector2D[] = []

export function initializeGame(username: string) {
    users = {}

    socket.emit('joined', username)
    
    socket.on('user-joined', (id: string, username: string) => {
        const span = document.createElement('span')
        span.textContent = `${username} has joined`
        span.style.color = 'white'
        chatLog(span)

        if (socket.id === id) return
        users[id] = username
    })

    socket.on('user-left', (id: string) => {
        const span = document.createElement('span')
        span.textContent = `${users[id]} has left`
        span.style.color = 'white'
        chatLog(span)

        delete users[id]
    })

    socket.on('welcome', (gameSettings: Settings, allUsers: UserCollection, instructions: DrawingInstruction[]) => {
        settings = gameSettings
        users = allUsers
        drawingInstructions = instructions

        new p5(activateSketch)
    })
}

function activateSketch(sketch: p5) {
    sketch.setup = () => {
        setup(sketch)
    }

    sketch.mouseDragged = () => {
        
    }

    sketch.draw = () => {
        input(sketch)
    }

    socket.on('new-path', (position: Vector2D, color: RGBA, weight: number) => {
        const instruction = {
            path: [position],
            color: color,
            weight: weight
        }

        sketch.stroke(color.red, color.green, color.blue, color.alpha)
        sketch.strokeWeight(weight)
        sketch.point(position.x, position.y)

        drawingInstructions.push(instruction)
    })

    socket.on('drawing-position', (position: Vector2D) => {
        const instruction = drawingInstructions[drawingInstructions.length - 1]
        const previousPosition = instruction.path[instruction.path.length - 1]
        sketch.line(previousPosition.x, previousPosition.y, position.x, position.y)

        instruction.path.push(position)
    })

    socket.on('undo', () => {
        drawingInstructions.pop()

        redrawAll(sketch)
    })
}

function redrawAll(sketch: p5) {
    sketch.background(255, 255, 255)

    for (let index = 0; index < drawingInstructions.length; index += 1) {
        executeInstruction(sketch, drawingInstructions[index])
    }
}

function chatLog(span: HTMLSpanElement) {
    chat.insertBefore(document.createElement('br'), chat.firstChild)
    chat.insertBefore(span, chat.firstChild)
    const time = document.createElement('span')
    time.textContent = `${hoursMinutesSeconds()}: `
    time.style.color = 'white'
    chat.insertBefore(time, chat.firstChild)
}

function hoursMinutesSeconds(): string {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const seconds = now.getSeconds().toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
}

function setup(sketch: p5) {
    const renderer = sketch.createCanvas(settings.canvasWidth, settings.canvasHeight)
    container.insertAdjacentElement('afterbegin', renderer.elt)
    sketch.frameRate(60)

    redrawAll(sketch)

    undoButton.addEventListener('click', () => {
        if (drawingInstructions.length === 0) return
        drawingInstructions.pop()

        redrawAll(sketch)

        socket.emit('undo')
    })

    weightSlider.min = settings.weightSliderMinimum.toString()
    weightSlider.max = settings.weightSliderMaximum.toString()
    weightSlider.value = settings.weightSliderDefault.toString()
    weightSpan.textContent = weightSlider.value

    weightSlider.addEventListener('input', () => {
        weightSpan.textContent = weightSlider.value
    })
}

function input(sketch: p5) {
    if (sketch.mouseIsPressed) {
        if (sketch.mouseButton === sketch.LEFT) {
            if (!isInsideCanvas({ x: sketch.mouseX, y: sketch.mouseY })) return

            if (path.length === 0) {
                const weight = parseFloat(weightSlider.value)

                sketch.stroke(0, 0, 0, 255)
                sketch.strokeWeight(weight)
                sketch.point(sketch.mouseX, sketch.mouseY)

                path.push({ x: sketch.mouseX, y: sketch.mouseY })

                socket.emit('new-path', { x: sketch.mouseX, y: sketch.mouseY }, { red: 0, green: 0, blue: 0, alpha: 255 }, weight)
            } else {
                const previousPosition = path[path.length - 1]
                sketch.line(previousPosition.x, previousPosition.y, sketch.mouseX, sketch.mouseY)

                path.push({ x: sketch.mouseX, y: sketch.mouseY })

                socket.emit('drawing-position', { x: sketch.mouseX, y: sketch.mouseY })
            }
        }
    } else {
        if (path.length > 0) {
            const instruction = {
                path: path,
                color: { red: 0, green: 0, blue: 0, alpha: 255 },
                weight: parseFloat(weightSlider.value)
            }

            drawingInstructions.push(instruction)

            path = []
        }
    }
}

function executeInstruction(sketch: p5, instruction: DrawingInstruction) {
    sketch.noFill()
    sketch.stroke(instruction.color.red, instruction.color.green, instruction.color.blue, instruction.color.alpha)
    sketch.strokeWeight(instruction.weight)
    if (instruction.path.length === 1) {
        const position = instruction.path[0]
        sketch.point(position.x, position.y)
    } else {
        sketch.beginShape()
        for (let index = 0; index < instruction.path.length; index += 1) {
            const position = instruction.path[index]
            sketch.vertex(position.x, position.y)
        }
        sketch.endShape()
    }
}

function isInsideCanvas(position: Vector2D): boolean {
    return position.x >= 0 &&
           position.x < settings.canvasWidth &&
           position.y >= 0 &&
           position.y < settings.canvasHeight
}