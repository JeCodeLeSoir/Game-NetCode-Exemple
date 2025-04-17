let LocalID = -1;

const ip = "http://game-netcode-exemple.railway.internal";
const port = 3030;

const REQ_ConnexionJOIN = 0;
const REQ_PlayerJOIN = 1;
const REQ_PlayerSYNC = 2;
const REQ_PlayerLEAVE = 3;

//C'est la list des joueurs
const objects = [];

const client = new WebSocket(`${ip}:${port}`);

client.onopen = () => {
  console.log("Connected to the server");
}

client.onclose = () => {
  console.log("Disconnected from the server");
}

client.onmessage = (event) => {
  const paquet = JSON.parse(event.data);

  switch (paquet.resquetID) {
    case REQ_ConnexionJOIN:
      LocalID = paquet.data.id;
      const player = new Player(LocalID, {
        x: centerX - paquet.data.x / 2,
        y: centerY - paquet.data.y / 2,
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
      const syncPlayer = objects.find((object) => object.id === paquet.data.id);
      if (syncPlayer) {
        syncPlayer.pos.x = paquet.data.x;
        syncPlayer.pos.y = paquet.data.y;
      }
      else {
        console.log("Player not found", paquet.data.id);
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

class Player {

  constructor(id, pos) {
    this.input = new Input();
    this.id = id;
    this.pos = pos;
    this.speed = 20;
  }

  Update(elapsed) {
    if (LocalID != this.id) {
      return;
    }

    if (this.input.isKeyPressed("ArrowUp")) {
      this.pos.y -= this.speed * elapsed / 100;
    }
    if (this.input.isKeyPressed("ArrowDown")) {
      this.pos.y += this.speed * elapsed / 100;
    }
    if (this.input.isKeyPressed("ArrowLeft")) {
      this.pos.x -= this.speed * elapsed / 100;
    }
    if (this.input.isKeyPressed("ArrowRight")) {
      this.pos.x += this.speed * elapsed / 100;
    }

    client.send(JSON.stringify({
      resquetID: REQ_PlayerSYNC,
      data: {
        x: this.pos.x,
        y: this.pos.y,
      },
    }));
  }

  draw(ctx) {
    ctx.fillStyle = "red";
    ctx.fillRect(this.pos.x, this.pos.y, 50, 50);
  }

}

let lastTime;
const requiredElapsed = 1000 / 30; // 30 FPS

const canvas = document.getElementById("game");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

console.log("Canvas size: ", canvas.width, canvas.height);
console.log("Center: ", centerX, centerY);

if (!canvas) {
  console.error("Canvas element not found");
}

const ctx = canvas.getContext("2d");

if (!ctx) {
  console.error("Failed to get canvas context");
}

function HandleTick(elapsed) {

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "30px Arial";
  ctx.fillText("NetCode V1", 10, 50);
  ctx.fillText("FPS: " + Math.floor(1000 / elapsed), 10, 100);
  ctx.fillText("LocalID: " + LocalID, 10, 150);

  objects.forEach((object) => {
    object.Update(elapsed);
    object.draw(ctx);
  });
}

function Update(now) {
  requestAnimationFrame(Update);

  if (!lastTime) { lastTime = now; }
  let elapsed = now - lastTime;

  if (elapsed > requiredElapsed) {
    HandleTick(elapsed);
    lastTime = now;
  }
}

Update();