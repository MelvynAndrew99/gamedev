import Phaser from 'phaser';

class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    // Background
    this.add.rectangle(400, 300, 800, 600, 0x1a1a1a).setOrigin(0.5);

    // Title
    this.add.text(400, 100, 'DESTRUCTION RACER', {
      fontSize: '48px',
      fill: '#ff0000',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    // Draw a simple car
    const carGroup = this.add.group();
    carGroup.add(this.add.rectangle(400, 200, 40, 60, 0xff0000)); // Body
    carGroup.add(this.add.rectangle(395, 190, 15, 20, 0x000000)); // Left wheel
    carGroup.add(this.add.rectangle(405, 190, 15, 20, 0x000000)); // Right wheel
    carGroup.add(this.add.rectangle(395, 220, 15, 20, 0x000000)); // Back left
    carGroup.add(this.add.rectangle(405, 220, 15, 20, 0x000000)); // Back right

    // Instructions
    this.add.text(400, 350, 'Race, Destroy, Win!', {
      fontSize: '32px',
      fill: '#ffff00',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(400, 420, 'Arrow Keys to Steer', {
      fontSize: '20px',
      fill: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(400, 500, 'Press ENTER to Start', {
      fontSize: '24px',
      fill: '#00ff00',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    // Input
    this.input.keyboard.on('keydown-ENTER', () => {
      this.scene.start('GameScene');
    });
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.roadSegments = [];
    this.obstacles = [];
    this.roadSpeed = 12;
    this.carSpeed = 500;
    this.obstacleChance = 0.15;
    this.gameActive = true;
    this.distance = 0;
    this.currentLaneOffset = 0;
    this.targetLaneOffset = 0;
    this.isMaroKartView = false;
    this.segmentHeight = 60;
  }

  preload() {
    // Graphics created procedurally
  }

  create() {
    // Game state
    this.gameActive = true;
    this.distance = 0;

    // Create player car (red)
    this.playerCar = this.add.rectangle(400, 520, 40, 60, 0xff0000);
    this.physics.add.existing(this.playerCar);
    this.playerCar.body.setCollideWorldBounds(true);
    this.playerCar.setData('name', 'Player');

    // Road lanes
    this.roadLeft = 250;
    this.roadRight = 550;
    this.roadWidth = this.roadRight - this.roadLeft;

    // Initialize road segments - start much further back
    for (let i = 0; i < 15; i++) {
      this.createRoadSegment(i * 60);
    }

    // UI
    this.distanceText = this.add.text(16, 16, 'Distance: 0', {
      fontSize: '20px',
      fill: '#fff',
      fontStyle: 'bold',
    });

    this.playerHealthText = this.add.text(16, 50, 'Distance: 0m', {
      fontSize: '16px',
      fill: '#ffffff',
    });

    this.gameOverText = this.add.text(400, 300, '', {
      fontSize: '48px',
      fill: '#ff0000',
      align: 'center',
    });
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setDepth(100);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    // Setup debug panel event listeners
    this.setupDebugPanel();
  }

  setupDebugPanel() {
    const roadSpeedSlider = document.getElementById('roadSpeed');
    const carSpeedSlider = document.getElementById('carSpeed');
    const obstacleChanceSlider = document.getElementById('obstacleChance');
    const viewToggleBtn = document.getElementById('viewToggle');

    roadSpeedSlider.addEventListener('input', (e) => {
      this.roadSpeed = parseFloat(e.target.value);
      document.getElementById('roadSpeedValue').textContent = this.roadSpeed;
      // Update all existing segments
      this.roadSegments.forEach(seg => {
        seg.roadBg.body.setVelocityY(this.roadSpeed);
        seg.leftLine.body.setVelocityY(this.roadSpeed);
        seg.rightLine.body.setVelocityY(this.roadSpeed);
        seg.centerLine.body.setVelocityY(this.roadSpeed);
      });
      this.obstacles.forEach(obs => {
        obs.body.setVelocityY(this.roadSpeed);
      });
    });

    carSpeedSlider.addEventListener('input', (e) => {
      this.carSpeed = parseFloat(e.target.value);
      document.getElementById('carSpeedValue').textContent = this.carSpeed;
    });

    obstacleChanceSlider.addEventListener('input', (e) => {
      this.obstacleChance = parseFloat(e.target.value) / 100;
      document.getElementById('obstacleChanceValue').textContent = e.target.value + '%';
    });

    viewToggleBtn.addEventListener('click', () => {
      this.toggleView();
    });

    // Update FPS counter
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        document.getElementById('fps').textContent = Math.round(this.game.loop.actualFps);
      },
      loop: true,
    });
  }

  toggleView() {
    this.isMaroKartView = !this.isMaroKartView;
    const viewLabel = document.getElementById('currentView');
    const viewToggle = document.getElementById('viewToggle');
    
    if (this.isMaroKartView) {
      viewLabel.textContent = 'Mario Kart';
      viewToggle.textContent = 'Switch to Top-Down View';
      this.cameras.main.setZoom(1);
      this.cameras.main.setRotation(0.3); // Slight tilt for perspective
    } else {
      viewLabel.textContent = 'Top-Down';
      viewToggle.textContent = 'Switch to Mario Kart View';
      this.cameras.main.setZoom(1);
      this.cameras.main.setRotation(0);
    }
  }

  createRoadSegment(y) {
    // Update curve: occasionally pick a new target offset
    if (Math.random() < 0.08) {
      this.targetLaneOffset = Phaser.Math.Between(-80, 80);
    }
    
    // Smoothly move towards target offset
    this.currentLaneOffset += (this.targetLaneOffset - this.currentLaneOffset) * 0.1;

    // Base lane center
    const baseLaneCenter = 400;
    const currentLaneLeft = this.roadLeft + this.currentLaneOffset;
    const currentLaneRight = this.roadRight + this.currentLaneOffset;

    // Road background (asphalt)
    const roadBg = this.add.rectangle(
      baseLaneCenter + this.currentLaneOffset,
      y,
      this.roadWidth + 40,
      60,
      0x444444
    );
    this.physics.add.existing(roadBg);
    roadBg.body.setVelocityY(this.roadSpeed);
    roadBg.setDepth(-1);

    // Left lane line (yellow)
    const leftLine = this.add.rectangle(
      currentLaneLeft - 8,
      y,
      4,
      60,
      0xffff00
    );
    this.physics.add.existing(leftLine);
    leftLine.body.setVelocityY(this.roadSpeed);

    // Right lane line (yellow)
    const rightLine = this.add.rectangle(
      currentLaneRight + 8,
      y,
      4,
      60,
      0xffff00
    );
    this.physics.add.existing(rightLine);
    rightLine.body.setVelocityY(this.roadSpeed);

    // Center dashed line
    const centerLine = this.add.rectangle(baseLaneCenter + this.currentLaneOffset, y, 3, 30, 0xffffff);
    centerLine.setAlpha(0.4);
    this.physics.add.existing(centerLine);
    centerLine.body.setVelocityY(this.roadSpeed);

    this.roadSegments.push({ 
      roadBg, 
      leftLine, 
      rightLine, 
      centerLine,
      laneLeft: currentLaneLeft,
      laneRight: currentLaneRight
    });

    // Randomly add obstacles (in road area)
    if (Math.random() < this.obstacleChance && y < -200) {
      const lanePositions = [
        currentLaneLeft + 50,
        baseLaneCenter + this.currentLaneOffset,
        currentLaneRight - 50
      ];
      const randomLane = Phaser.Utils.Array.GetRandom(lanePositions);
      this.createObstacle(randomLane, y);
    }
  }

  createObstacle(x, y) {
    const obstacle = this.add.rectangle(x, y, 35, 35, 0xff6600);
    this.physics.add.existing(obstacle);
    obstacle.body.setVelocityY(this.roadSpeed);
    
    this.obstacles.push(obstacle);
  }

  update() {
    if (!this.gameActive) return;

    // Player movement
    this.playerCar.body.setVelocity(0, 0);

    if (this.cursors.left.isDown) {
      this.playerCar.body.setVelocityX(-this.carSpeed);
    } else if (this.cursors.right.isDown) {
      this.playerCar.body.setVelocityX(this.carSpeed);
    }

    // Find the nearest road segment to check lane boundaries
    const nearestSegment = this.roadSegments.find(s => s.roadBg.y > this.playerCar.y - 50 && s.roadBg.y < this.playerCar.y + 50);
    
    if (nearestSegment) {
      // Keep player on road using current segment's lane boundaries
      this.playerCar.x = Phaser.Math.Clamp(
        this.playerCar.x,
        nearestSegment.laneLeft + 20,
        nearestSegment.laneRight - 20
      );

      // Check if off road (crashed)
      if (
        this.playerCar.x < nearestSegment.laneLeft + 10 ||
        this.playerCar.x > nearestSegment.laneRight - 10
      ) {
        this.gameActive = false;
        this.gameOverText.setText('CRASHED OFF ROAD!\nPress R to Restart');
      }
    }

    // Check collision with obstacles
    this.physics.overlap(this.playerCar, this.obstacles, (car, obstacle) => {
      this.gameActive = false;
      this.gameOverText.setText('HIT OBSTACLE!\nPress R to Restart');
    });

    // Clean up road segments
    this.roadSegments = this.roadSegments.filter((segment) => {
      if (segment.roadBg.y > 650) {
        segment.roadBg.destroy();
        segment.leftLine.destroy();
        segment.rightLine.destroy();
        segment.centerLine.destroy();
        return false;
      }
      return true;
    });

    // Create new segments as needed - keep more segments buffered
    if (this.roadSegments.length < 12) {
      const lastSegment = this.roadSegments[this.roadSegments.length - 1];
      this.createRoadSegment(lastSegment.roadBg.y - 60);
    }

    // Clean up obstacles
    this.obstacles = this.obstacles.filter((obs) => {
      if (obs.y > 650) {
        obs.destroy();
        return false;
      }
      return true;
    });

    // Update distance
    this.distance += 0.1;
    this.distanceText.setText(`Distance: ${Math.floor(this.distance)}m`);
    this.playerHealthText.setText(`Speed: ${Math.abs(Math.floor(this.playerCar.body.velocity.x / 10))}%`);

    // Restart on R key
    if (this.rKey.isDown && !this.gameActive) {
      this.scene.start('TitleScene');
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [TitleScene, GameScene],
  backgroundColor: '#2a5f2a',
};

const game = new Phaser.Game(config);
