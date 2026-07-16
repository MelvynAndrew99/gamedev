import Phaser from 'phaser';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: GameScene,
};

const game = new Phaser.Game(config);

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.roadSegments = [];
    this.roadSpeed = 5;
    this.gameActive = true;
    this.score = 0;
  }

  preload() {
    // Load or create graphics
  }

  create() {
    // Create player car
    this.car = this.add.rectangle(400, 520, 40, 60, 0xff0000);
    this.physics.add.existing(this.car);
    this.car.body.setCollideWorldBounds(true);

    // Road lanes
    this.roadLeft = 250;
    this.roadRight = 550;
    this.laneWidth = 100;

    // Initialize road segments
    for (let i = 0; i < 10; i++) {
      this.createRoadSegment(i * 60);
    }

    // UI
    this.scoreText = this.add.text(16, 16, 'Distance: 0', {
      fontSize: '24px',
      fill: '#fff',
    });

    this.gameOverText = this.add.text(400, 300, '', {
      fontSize: '48px',
      fill: '#ff0000',
      align: 'center',
    });
    this.gameOverText.setOrigin(0.5);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  createRoadSegment(y) {
    // Road background
    const roadBg = this.add.rectangle(
      400,
      y,
      this.roadRight - this.roadLeft + 20,
      60,
      0x333333
    );
    this.physics.add.existing(roadBg);
    roadBg.body.setVelocityY(this.roadSpeed);

    // Left lane line
    const leftLine = this.add.line(
      this.roadLeft,
      y,
      0,
      0,
      0,
      60,
      0xffff00
    );
    this.physics.add.existing(leftLine);
    leftLine.body.setVelocityY(this.roadSpeed);

    // Right lane line
    const rightLine = this.add.line(
      this.roadRight,
      y,
      0,
      0,
      0,
      60,
      0xffff00
    );
    this.physics.add.existing(rightLine);
    rightLine.body.setVelocityY(this.roadSpeed);

    // Center lane line (dashed effect)
    const centerLine = this.add.rectangle(
      400,
      y,
      2,
      30,
      0xffffff
    );
    centerLine.setAlpha(0.5);
    this.physics.add.existing(centerLine);
    centerLine.body.setVelocityY(this.roadSpeed);

    this.roadSegments.push({ roadBg, leftLine, rightLine, centerLine });
  }

  update() {
    if (!this.gameActive) return;

    // Car movement
    this.car.body.setVelocity(0, 0);

    if (this.cursors.left.isDown) {
      this.car.body.setVelocityX(-300);
    } else if (this.cursors.right.isDown) {
      this.car.body.setVelocityX(300);
    }

    // Keep car in bounds
    this.car.x = Phaser.Math.Clamp(this.car.x, 150, 650);

    // Check if off road (crashed)
    if (this.car.x < this.roadLeft || this.car.x > this.roadRight) {
      this.gameActive = false;
      this.gameOverText.setText('CRASHED!\nPress R to Restart');
    }

    // Clean up and create new road segments
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

    if (this.roadSegments.length < 8) {
      const lastSegment = this.roadSegments[this.roadSegments.length - 1];
      this.createRoadSegment(lastSegment.roadBg.y - 60);
    }

    // Update score
    this.score += 0.1;
    this.scoreText.setText(`Distance: ${Math.floor(this.score)}`);

    // Restart on R key
    if (this.input.keyboard.isDown('R') && !this.gameActive) {
      this.scene.restart();
    }
  }
}
