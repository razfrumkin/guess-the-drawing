import p5 from 'p5'
import { socket } from './join'

const container = document.getElementById('container') as HTMLDivElement
const resetButton = document.getElementById('reset-button') as HTMLButtonElement

const redSlider = document.getElementById('red-slider') as HTMLInputElement
const greenSlider = document.getElementById('green-slider') as HTMLInputElement
const blueSlider = document.getElementById('blue-slider') as HTMLInputElement

const redSpan = document.getElementById('red-span') as HTMLSpanElement
const greenSpan = document.getElementById('green-span') as HTMLSpanElement
const blueSpan = document.getElementById('blue-span') as HTMLSpanElement

const undoButton = document.getElementById('undo-button') as HTMLButtonElement
const weightSlider = document.getElementById('weight-slider') as HTMLInputElement
const weightSpan = document.getElementById('weight-span') as HTMLSpanElement
const fillCheckbox = document.getElementById('fill-checkbox') as HTMLInputElement
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
type RGB = { red: number, green: number, blue: number }

type Stroke = {
    path: Vector2D[]
    color: RGB
    weight: number
}

type Fill = {
    position: Vector2D
    color: RGB
}

enum DrawingInstructionType {
    STROKE,
    FILL
}

type DrawingInstruction = {
    type: DrawingInstructionType
    value: Stroke | Fill
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

    sketch.mousePressed = () => {
        mousePressed(sketch)
    }

    sketch.draw = () => {
        input(sketch)
    }

    socket.on('new-path', (position: Vector2D, color: RGB, weight: number) => {
        const instruction = {
            path: [position],
            color: color,
            weight: weight
        }

        sketch.stroke(color.red, color.green, color.blue)
        sketch.strokeWeight(weight)
        sketch.point(position.x, position.y)

        drawingInstructions.push({ type: DrawingInstructionType.STROKE, value: instruction })
    })

    socket.on('drawing-position', (position: Vector2D) => {
        const stroke = drawingInstructions[drawingInstructions.length - 1].value as Stroke
        const previousPosition = stroke.path[stroke.path.length - 1]
        sketch.line(previousPosition.x, previousPosition.y, position.x, position.y)

        stroke.path.push(position)
    })

    socket.on('fill', (fill: Fill) => {
        floodFill(sketch, fill)

        drawingInstructions.push({ type: DrawingInstructionType.FILL, value: fill })
    })

    socket.on('reset', () => {
        drawingInstructions = []

        sketch.background(255, 255, 255)
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
    sketch.noSmooth()

    redrawAll(sketch)

    resetButton.addEventListener('click', () => {
        drawingInstructions = []

        sketch.background(255, 255, 255)

        socket.emit('reset')
    })

    undoButton.addEventListener('click', () => {
        if (drawingInstructions.length === 0) return
        drawingInstructions.pop()

        redrawAll(sketch)

        socket.emit('undo')
    })

    redSlider.addEventListener('change', () => {
        redSpan.textContent = redSlider.value
    })

    greenSlider.addEventListener('change', () => {
        greenSpan.textContent = greenSlider.value
    })
    
    blueSlider.addEventListener('change', () => {
        blueSpan.textContent = blueSlider.value
    })

    weightSlider.min = settings.weightSliderMinimum.toString()
    weightSlider.max = settings.weightSliderMaximum.toString()
    weightSlider.value = settings.weightSliderDefault.toString()
    weightSpan.textContent = weightSlider.value

    weightSlider.addEventListener('input', () => {
        weightSpan.textContent = weightSlider.value
    })
}

function mousePressed(sketch: p5) {
    if (sketch.mouseButton === sketch.LEFT) {
        const mouse = { x: sketch.mouseX, y: sketch.mouseY }

        if (!isInsideCanvas(mouse)) return

        if (fillCheckbox.checked) {
            const color = getInputColor()

            const fill = { position: mouse, color: color }

            floodFill(sketch, fill)

            drawingInstructions.push({ type: DrawingInstructionType.FILL, value: fill })

            socket.emit('fill', fill)
        }
    }
}

function input(sketch: p5) {
    if (sketch.mouseIsPressed) {
        if (sketch.mouseButton === sketch.LEFT) {
            const mouse = { x: sketch.mouseX, y: sketch.mouseY }
            const color = getInputColor()

            if (!isInsideCanvas(mouse)) return

            if (fillCheckbox.checked) return

            if (path.length === 0) {
                const weight = parseFloat(weightSlider.value)

                sketch.stroke(color.red, color.green, color.blue)
                sketch.strokeWeight(weight)
                sketch.point(mouse.x, mouse.y)

                path.push(mouse)

                socket.emit('new-path', mouse, color, weight)
            } else {
                const previousPosition = path[path.length - 1]
                sketch.line(previousPosition.x, previousPosition.y, mouse.x, mouse.y)

                path.push(mouse)

                socket.emit('drawing-position', mouse)
            }
        }
    } else {
        if (path.length > 0) {
            const instruction = {
                path: path,
                color: getInputColor(),
                weight: parseFloat(weightSlider.value)
            }

            drawingInstructions.push({ type: DrawingInstructionType.STROKE, value: instruction })

            path = []
        }
    }
}

function floodFill(sketch: p5, fill: Fill) {
    const targetColor = getPixelColor(sketch, fill.position)

    if (match(fill.color, targetColor)) return

    sketch.loadPixels()

    const visited = new Array<Array<boolean>>(settings.canvasWidth)
    for (let index = 0; index < visited.length; index += 1) {
        visited[index] = new Array<boolean>(settings.canvasHeight).fill(false)
    }

    const pixels = [fill.position]

    while (pixels.length > 0) {
        const last = pixels.pop()!

        if (!visited[last.x][last.y]) {
            visited[last.x][last.y] = true
            const currentColor = getPixelColor(sketch, last)

            if (match(currentColor, targetColor)) {
                setPixelColor(sketch, last, fill.color)
    
                if (last.x > 0) pixels.push({ x: last.x - 1, y: last.y })
                if (last.x < settings.canvasWidth - 1) pixels.push({ x: last.x + 1, y: last.y })
                if (last.y > 0) pixels.push({ x: last.x, y: last.y - 1 })
                if (last.y < settings.canvasHeight - 1) pixels.push({ x: last.x, y: last.y + 1 })
            }
        }
    }

    sketch.updatePixels()
}

function executeInstruction(sketch: p5, instruction: DrawingInstruction) {
    if (instruction.type === DrawingInstructionType.FILL) {
        const fill = instruction.value as Fill

        floodFill(sketch, fill)

        return
    }

    const stroke = instruction.value as Stroke

    sketch.noFill()
    sketch.stroke(stroke.color.red, stroke.color.green, stroke.color.blue)
    sketch.strokeWeight(stroke.weight)
    if (stroke.path.length === 1) {
        const position = stroke.path[0]
        sketch.point(position.x, position.y)
    } else {
        sketch.beginShape()
        for (let index = 0; index < stroke.path.length; index += 1) {
            const position = stroke.path[index]
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

function getInputColor(): RGB {
    return {
        red: parseFloat(redSlider.value),
        green: parseFloat(greenSlider.value),
        blue: parseFloat(blueSlider.value),
    }
}

function getPixelColor(sketch: p5, position: Vector2D): RGB {
    const color = sketch.get(position.x, position.y)
    return { red: color[0], green: color[1], blue: color[2] }
}

function setPixelColor(sketch: p5, position: Vector2D, color: RGB) {
    sketch.set(position.x, position.y, [color.red, color.green, color.blue, 255])
}

function match(first: RGB, second: RGB): boolean {
    return first.red === second.red && first.green === second.green && first.blue === second.blue
}