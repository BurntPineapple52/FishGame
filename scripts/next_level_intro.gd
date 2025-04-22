extends Node2D
@onready var camera_2d = $Camera2D
@onready var transitioner = $"../Transitioner"
var start_pos
var scene_bear = load("res://scenes/stages/bear_stage.tscn")

@export var stage_xbounds = Vector2(-200,7600)
@export var camera_xbounds = Vector2(0,7600)
@export var camera_ybounds = Vector2(-20,1000)

func _ready():
	start_pos = camera_2d.position
	transitioner.color = Color(0,0,0,0)
	transitioner.position = start_pos
	pass
	
func _on_area_2d_body_entered(body):
	if body.is_in_group("player"):
		get_tree().create_tween().tween_property(camera_2d,"position",camera_2d.position+Vector2(2000,2000),1).set_ease(Tween.EASE_OUT)
		await get_tree().create_tween().tween_property(transitioner,"color",Color(0,0,0,1),1).set_ease(Tween.EASE_IN).finished
		get_tree().create_tween().tween_property(transitioner,"color",Color(0,0,0,0),1).set_ease(Tween.EASE_OUT).finished
		
		process_mode=Node.PROCESS_MODE_DISABLED

