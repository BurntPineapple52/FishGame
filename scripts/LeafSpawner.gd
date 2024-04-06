extends Node2D

var leaf_array = [preload("res://scenes/environment/leaf1.tscn"),preload("res://scenes/environment/leaf2.tscn")]
@onready var timer = $Timer
@onready var test_stage = $".."

var timer_length = 1
var timer_rng = .5


# Called when the node enters the scene tree for the first time.
func _ready():
	timer.set_wait_time(timer_length+randf_range(0,timer_rng))

func _on_timer_timeout():
	print("bing")
	var temp = leaf_array[randi_range(0,leaf_array.size()-1)].instantiate()
	test_stage.add_child(temp)
	temp.position = position
	
	timer.set_wait_time(timer_length+randf_range(0,timer_rng))
	pass # Replace with function body.
