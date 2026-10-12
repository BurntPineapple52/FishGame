extends RigidBody2D

var attack_force = 70000
var up_force = -30000
var attacking = 0
var attack_torque = -300000
var smack_damage = 35
@export var smack_force = 20000
@export var smack_torque = -100000
@export var smack_direction = Vector2(-1,0)
@onready var pin_joint_2d = $"../PinJoint2D"
@onready var bear_arm = $"../.."


# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.

#func _integrate_forces(state):
	#
	#pass

func _physics_process(delta):
	#apply_torque(attack_torque)
	#if Input.is_action_just_pressed("ui_up"):
		##apply_impulse(Vector2(attack_force,up_force))
		##apply_impulse(Vector2(attack_force,up_force),position)
		#apply_torque_impulse(attack_torque)
	pass

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass


	#jenkily connected arm collision to this as well
func _on_body_entered(body):
	if body.is_in_group("player"):
		print("player smacked")
		body.smack(smack_force*smack_direction, smack_torque, smack_damage)
