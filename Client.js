// Global variables

let _DeltaTime_;

let LocalID = -1,
  client;

//const ip = "ws://game-netcode-exemple-production.up.railway.app";
//const port = 8080;

const REQ_ConnexionJOIN = 0,
  REQ_PlayerJOIN = 1,
  REQ_PlayerSYNC = 2,
  REQ_PlayerLEAVE = 3,
  REQ_PlayerInputPayload = 4,
  REQ_PlayerStatePayload = 5;

//C'est la list des joueurs
const objects = [];

// Gestion des input clavier et souris
class Input {
  constructor() {
    this.keys = new Set();

    this.mouse = {
      x: 0,
      y: 0,
      down: false,
    };

    window.addEventListener("keydown", (event) => {
      this.keys.add(event.key);
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.key);
    });

    window.addEventListener("mousemove", (event) => {
      this.mouse.x = event.clientX;
      this.mouse.y = event.clientY;
    });

    window.addEventListener("mousedown", () => {
      this.mouse.down = true;
    });

    window.addEventListener("mouseup", () => {
      this.mouse.down = false;
    });
  }

  isKeyPressed(key) {
    return this.keys.has(key);
  }

  isMouseDown() {
    return this.mouse.down;
  }

  getMousePosition() {
    return {
      x: this.mouse.x,
      y: this.mouse.y,
    };
  }
}

// Payload class
class Payload {
  constructor(value, tick) {
    this.value = value;
    this.tick = tick;
  }

  get Value() {
    return this.value;
  }

  set Value(value) {
    this.value = value;
  }

  get Tick() {
    return this.tick;
  }

  set Tick(tick) {
    this.tick = tick;
  }

}


const BUFFER_SIZE = 1024;
const SERVER_TICK_RATE = 30;
const minTimeBetweenTicks = 1 / SERVER_TICK_RATE;

// Player class
class Player {

  constructor(id, pos) {
    this.input = new Input();
    this.id = id;

    this.dir = {
      x: 0,
      y: 0,
    }

    this.pos = pos;
    this.speed = 150;

    this.timer = 0;
    this.currentTick = 0;

    this.stateBuffer = []
    this.inputBuffer = []

    this.latestServerState = null;
    this.lastProcessedState = null;
  }

  set LatestServerState(value) {
    this.latestServerState = value;
  }

  Distance(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
  }

  HandleServerReconciliation() {
    this.lastProcessedState = this.latestServerState;

    let serverStateBufferIndex = this.latestServerState.tick % BUFFER_SIZE;
    let positionError = Distance(
      this.latestServerState.value.position,
      this.stateBuffer[serverStateBufferIndex].value.position);

    if (positionError > 0.001) {
      this.pos = latestServerState.value.pos;

      this.stateBuffer[serverStateBufferIndex] = this.latestServerState;
      let tickToProcess = this.latestServerState.tick + 1;

      while (tickToProcess < this.currentTick) {
        let bufferIndex = tickToProcess % BUFFER_SIZE;

        // Process new movement with reconciled state
        let statePayload = ProcessMovement(this.inputBuffer[bufferIndex]);

        // Update buffer with recalculated state
        this.stateBuffer[bufferIndex] = statePayload;

        tickToProcess++;
      }
    }
  }

  HandleTick() {

    if (!this.latestServerState === null &&
      (this.lastProcessedState === null ||
        !this.latestServerState === this.lastProcessedState)) {
      this.HandleServerReconciliation();
    }

    if (LocalID != this.id) {
      return;
    }

    const bufferIndex = this.currentTick % BUFFER_SIZE;

    const inputPayload = new Payload();

    inputPayload.tick = this.currentTick;
    inputPayload.value = {
      dir: this.dir
    }

    this.inputBuffer[bufferIndex] = inputPayload;
    this.stateBuffer[bufferIndex] = this.ProcessMovement(inputPayload);

    client.send(JSON.stringify({
      resquetID: REQ_PlayerInputPayload,
      data: inputPayload,
    }));

    //console.log("Sending input", inputPayload, "at tick", this.currentTick);

  }

  ProcessMovement(inputPayload) {
    this.pos.x += inputPayload.value.dir.x * this.speed * _DeltaTime_;
    this.pos.y += inputPayload.value.dir.y * this.speed * _DeltaTime_;

    let statePayload = new Payload()

    statePayload.tick = inputPayload.tick;
    statePayload.value = {
      pos: this.pos,
    }

    return statePayload;
  }

  UpdateInput() {

    if (this.input.isKeyPressed("ArrowUp")) {
      this.dir.y = -1;
    }
    else if (this.input.isKeyPressed("ArrowDown")) {
      this.dir.y = 1;
    }
    else {
      this.dir.y = 0;
    }

    if (this.input.isKeyPressed("ArrowLeft")) {
      this.dir.x = -1;
    }
    else if (this.input.isKeyPressed("ArrowRight")) {
      this.dir.x = 1;
    }
    else {
      this.dir.x = 0;
    }
  }

  Update() {

    if (LocalID != this.id) {
      return;
    }

    this.UpdateInput();

    this.timer += _DeltaTime_;

    while (this.timer >= minTimeBetweenTicks) {
      this.timer -= minTimeBetweenTicks;
      this.HandleTick();
      this.currentTick++;
    }

  }

  draw(ctx) {
    ctx.fillStyle = "red";
    ctx.fillRect(
      canvasCenterX + this.pos.x - (50 / 2),
      canvasCenterY + this.pos.y - (50 / 2)
      , 50, 50);
  }

}

const canvas = document.getElementById("game");

if (!canvas) {
  console.error("Canvas element not found");
}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const canvasCenterX = canvas.width / 2,
  canvasCenterY = canvas.height / 2;

const formeConnexion = document.getElementById("connection-form");

formeConnexion.addEventListener("submit", (event) => {
  event.preventDefault();

  // WebSocket connection

  const ip = document.getElementById("IP").value,
    port = document.getElementById("port").value;

  if (!ip || !port) {
    alert("Please enter both IP and port.");
    return;
  }

  console.log("Connecting to server at", ip, "on port", port);

  start(ip, port, () => {
    formeConnexion.style.display = "none";
  });

})

function start(ip, port, callback) {
  client = new WebSocket(`${ip}:${port}`);

  client.onopen = () => {
    console.log("Connected to the server");
    callback();
  }

  client.onclose = () => {
    console.log("Disconnected from the server");
    alert("Disconnected from the server");
  }

  client.onmessage = (event) => {
    const paquet = JSON.parse(event.data);

    switch (paquet.resquetID) {
      case REQ_ConnexionJOIN:
        LocalID = paquet.data.id;
        const player = new Player(LocalID, {
          x: paquet.data.x,
          y: paquet.data.y,
        });
        objects.push(player);
        break;
      case REQ_PlayerJOIN:
        const newPlayer = new Player(paquet.data.id, {
          x: paquet.data.x,
          y: paquet.data.y,
        });
        objects.push(newPlayer);
        break;
      case REQ_PlayerSYNC:
        {
          const syncPlayer = objects.find((object) => object.id === paquet.data.id);
          if (syncPlayer) {
            syncPlayer.pos.x = paquet.data.x;
            syncPlayer.pos.y = paquet.data.y;
          }
          else {
            console.log("Player not found", paquet.data.id);
          }
        }
        break;
      case REQ_PlayerInputPayload:
        const syncPlayer = objects.find((object) => object.id === paquet.data.id);

        if (syncPlayer) {
          //console.log("Player found", paquet.data);
          syncPlayer.LatestServerState = new Payload(paquet.data.value, paquet.data.tick);
        }

        break;
      case REQ_PlayerLEAVE:
        const leavePlayerIndex = objects.findIndex((object) => object.id === paquet.data.id);
        if (leavePlayerIndex !== -1) {
          objects.splice(leavePlayerIndex, 1);
        }
        break;
      default:
        console.log("Unknown request ID");
    }
  }

  // End WebSocket connection

  let lastTime, elapsed;

  const requiredElapsed = 1000 / 30; // 30 FPS

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    console.error("Failed to get canvas context");
    return;
  }

  function handleLogic() {
    objects.forEach((object) => {
      object.Update();
    });
  }

  function handleRender() {
    let fps = Math.floor(1000 / elapsed);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "30px Arial";
    ctx.fillText("NetCode V1", 10, 50);
    ctx.fillText("FPS: " + fps, 10, 100);
    ctx.fillText("DeltaTime: " + _DeltaTime_, 10, 150);
    ctx.fillText("LocalID: " + LocalID, 10, 200);

    objects.forEach((object) => {
      object.draw(ctx);
    });
  }

  function update(now) {
    requestAnimationFrame(update);

    if (LocalID === -1) {
      return;
    }

    if (!lastTime) { lastTime = now; }

    elapsed = now - lastTime;
    _DeltaTime_ = elapsed / 1000;

    if (elapsed > requiredElapsed) {
      handleLogic();
      handleRender();
      lastTime = now;
    }

  }

  update();

}