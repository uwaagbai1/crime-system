import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl

def evaluate_crime_likelihood(anger, fear, stress, sound, crowd, time_of_day):
    anger_level = ctrl.Antecedent(np.arange(0, 1.1, 0.1), 'anger')
    fear_level = ctrl.Antecedent(np.arange(0, 1.1, 0.1), 'fear')
    stress_level = ctrl.Antecedent(np.arange(0, 1.1, 0.1), 'stress')
    sound_level = ctrl.Antecedent(np.arange(0, 1.1, 0.1), 'sound')
    crowd_level = ctrl.Antecedent(np.arange(0, 1.1, 0.1), 'crowd')
    time = ctrl.Antecedent(np.arange(0, 24, 1), 'time')
    
    crime_likelihood = ctrl.Consequent(np.arange(0, 1.1, 0.1), 'crime_likelihood')
    
    for var in [anger_level, fear_level, stress_level, sound_level, crowd_level]:
        var['low'] = fuzz.trimf(var.universe, [0, 0, 0.5])
        var['medium'] = fuzz.trimf(var.universe, [0, 0.5, 1])
        var['high'] = fuzz.trimf(var.universe, [0.5, 1, 1])
    
    time['day'] = fuzz.trimf(time.universe, [0, 0, 12])
    time['night'] = fuzz.trimf(time.universe, [12, 24, 24])
    
    crime_likelihood['low'] = fuzz.trimf(crime_likelihood.universe, [0, 0, 0.5])
    crime_likelihood['medium'] = fuzz.trimf(crime_likelihood.universe, [0, 0.5, 1])
    crime_likelihood['high'] = fuzz.trimf(crime_likelihood.universe, [0.5, 1, 1])
    
    rule1 = ctrl.Rule(anger_level['high'] & time['night'], crime_likelihood['high'])
    rule2 = ctrl.Rule(fear_level['high'] & time['night'], crime_likelihood['high'])
    rule3 = ctrl.Rule(stress_level['high'] & sound_level['high'], crime_likelihood['high'])
    rule4 = ctrl.Rule(crowd_level['high'] & sound_level['high'], crime_likelihood['medium'])
    rule5 = ctrl.Rule(anger_level['low'] & fear_level['low'], crime_likelihood['low'])
    
    crime_ctrl = ctrl.ControlSystem([rule1, rule2, rule3, rule4, rule5])
    crime_detection = ctrl.ControlSystemSimulation(crime_ctrl)
    
    crime_detection.input['anger'] = anger
    crime_detection.input['fear'] = fear
    crime_detection.input['stress'] = stress
    crime_detection.input['sound'] = sound
    crime_detection.input['crowd'] = crowd
    crime_detection.input['time'] = time_of_day
    
    crime_detection.compute()
    return crime_detection.output['crime_likelihood']