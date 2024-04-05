extends RigidBody2D

@export var float_force = 1.0
@export var water_drag = 0.05
@export var water_angular_drag = 0.05

@onready var gravity:float = ProjectSettings.get_setting("physics/2d/default_gravity")

const water_height = 0.0

var submerged = false

#-----------------------

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass
	
func _physics_process(delta):
	submerged = false
	var depth = water_height + global_position.y
	if depth > 0:
		submerged = true
		apply_central_force(Vector2.UP * float_force * gravity * depth)

func _integrate_forces(state: PhysicsDirectBodyState2D):
	if submerged:
		#0 means no drag, 1 means max drag
		state.linear_velocity *= 1 - water_drag
		state.angular_velocity *= 1 - water_angular_drag
