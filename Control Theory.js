import { ExponentialCost, FirstFreeCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { parseBigNumber, BigNumber } from "../api/BigNumber";
import { theory } from "../api/Theory";
import { Utils } from "../api/Utils";

var id = "control_theory";
var name = "Control Theory";
var description = "Control Theory is a tool used in engineering to maintain a variable at a set value (known as the 'set point'). \n \n In this theory, you will be attempting to do the opposite - cause as much disturbance in the variable 'T' as possible while a controller attempts to stabilise the value to the set point. \n \n The controller works by calculating the error, e(t) between T and the set point, T_sp. The controller used in this theory will be a PID -- proportional, integral and derivative controller. K_p represents the proportional gain of the system - in other words how much the output changes depending on the error sum within the brackets. The integral term sums up the past errors and attempts to minimise the error after t_i seconds. The derivative term attempts to predict the future error after t_d seconds based on the current derivative of e(t). \n \n For this example, you will assume that this is a heating controller system. The PID controller will adjust the heater so that T reaches the set point. For the purpose of the simulation, u(t) will be considered as a percentage change, in the real world this would correspond to opening a valve to allow heating/cooling fluid to change the temperature. \n \n To make progress, you will need to disturb T to change rho, however going over a certain threshold will reset your progress. At some point you will also be able to manually change the values k_p, t_i, t_d to explore the system more deeply and to improve rho gain.";
var authors = "Gaunter";
var version = 1;

// debug variable
var debug = 0;

var publicationExponent = 0.33;
var getPublicationMultiplier = (tau) => tau.pow(publicationExponent);
var getPublicationMultiplierFormula = (symbol) => "{" + symbol + "}^{" + publicationExponent + "}";

// Currency
var rho;

var ThStepSize = 10;
var TcStepSize = -2;

// System variables
var T, output, kp, td, ti, setPoint, prevError, integral, systemDt, valve, timer, amplitude, frequency, autoKickerEnabled;
timer = 0;
frequency = 1;
T = BigNumber.from(100);
kp = 2;
ti = 0.05;
td = 0.2;
valve = 0;
integral = 0;
prevError = 0;
output = 0;
amplitude = 125;
autoKickerEnabled = false;
baseTolerance = 5; 

// Upgrades
var c1, Th, Tc, c2, c3, kickT, Tmax, changePidValues, autoKick;

// Milestones
var c1Exponent, toleranceReduction;
var init = () => {
  rho = theory.createCurrency();

  /////////////////////
  // Milestone Upgrades

  theory.setMilestoneCost(new LinearCost(8.33, 8.33));
  {
    c1Exponent = theory.createMilestoneUpgrade(0, 3);
    c1Exponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("c1", 0.05)
    c1Exponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("c1", "0.05")
    c1Exponent.boughtOrRefunded = (_) => updateAvailability();
  }
  {
    toleranceReduction = theory.createMilestoneUpgrade(1, 2);
    toleranceReduction.getInfo = (level) => Utils.getMathTo("\\epsilon" , getTolerance(level));
    toleranceReduction.getDescription = (level) => Utils.getMath("\\epsilon = " + getTolerance(level))
    toleranceReduction.boughtOrRefunded = (_) => updateAvailability();
  }

  /////////////////////
  // Permanent Upgrades
  {
    autoKick = theory.createPermanentUpgrade(0, rho, new LinearCost(1e3, 0));
    autoKick.maxLevel = 1;
    autoKick.getDescription = (_) => "Automatically adjust T";
    autoKick.getInfo = (_) => "Automatically adjusts T";
  }
  theory.createPublicationUpgrade(1, rho, 1e6);
  {
    changePidValues = theory.createPermanentUpgrade(2, rho, new LinearCost(1e8, 0));
    changePidValues.maxLevel = 1;
    changePidValues.getDescription = (_) => Localization.getUpgradeUnlockDesc("\\text{PID Menu}");
    changePidValues.getInfo = (_) => Localization.getUpgradeUnlockInfo("\\text{PID Menu}");
  }
  theory.createBuyAllUpgrade(3, rho, 1e10);
  theory.createAutoBuyerUpgrade(4, rho, 1e20);

  // Kick T
  {
    kickT = theory.createUpgrade(0, rho, new FreeCost())
    kickT.getDescription = (_) => Utils.getMath("T=125");
    kickT.getInfo = (_) => Utils.getMathTo("T=" + T, "T=125");
    kickT.bought = (_) => T = amplitude;
  }
  // c1
  {
    let getDesc = (level) => "c_1=2^{" + level + "}";
    let getInfo = (level) => "c_1=" + getC1(level).toString(0);
    c1 = theory.createUpgrade(1, rho, new ExponentialCost(3000, Math.log2(3)));
    c1.getDescription = (_) => Utils.getMath(getDesc(c1.level));
    c1.getInfo = (amount) => Utils.getMathTo(getInfo(c1.level), getInfo(c1.level + amount));
  }
  // c2
  {
    let getDesc = (level) => "c_2=" + getC2(level).toString(0);
    let getInfo = (level) => "c_2=" + getC2(level).toString(0);
    c2 = theory.createUpgrade(2, rho, new ExponentialCost(3000, Math.log2(10)));
    c2.getDescription = (_) => Utils.getMath(getDesc(c2.level));
    c2.getInfo = (amount) => Utils.getMathTo(getInfo(c2.level), getInfo(c2.level + amount));
  }
  // c3
  {
    let getDesc = (level) => "c_3=" + getC3(level).toString(0);
    let getInfo = (level) => "c_3=" + getC3(level).toString(0);
    c3 = theory.createUpgrade(3, rho, new ExponentialCost(3000, Math.log2(10)));
    c3.getDescription = (_) => Utils.getMath(getDesc(c3.level));
    c3.getInfo = (amount) => Utils.getMathTo(getInfo(c3.level), getInfo(c3.level + amount));
  }

  //Th
  {
    let getInfo = (level) => "T_h=" + getTh(level).toString();
    let getDesc = (level) => "T_h=" + getTh(level).toString();
    Th = theory.createUpgrade(4, rho, new ExponentialCost(3000, Math.log2(10)));
    Th.getDescription = (_) => Utils.getMath(getDesc(Th.level));
    Th.getInfo = (amount) => Utils.getMathTo(getInfo(Th.level), getInfo(Th.level + amount))
  }
  //Tc
  {
    let getInfo = (level) => "T_c=" + getTc(level).toString();
    let getDesc = (level) => "T_c=" + getTc(level).toString();
    Tc = theory.createUpgrade(5, rho, new ExponentialCost(3000, Math.log2(10)));
    Tc.getDescription = (_) => Utils.getMath(getDesc(Tc.level));
    Tc.getInfo = (amount) => Utils.getMathTo(getInfo(Tc.level), getInfo(Tc.level + amount))
  }
  //Tmax
  {
    let getInfo = (level) => "T_{max}=" + getTmax(level).toString();
    let getDesc = (level) => "T_{max}=" + getTmax(level).toString();
    Tmax = theory.createUpgrade(6, rho, new ExponentialCost(10000, Math.log2(10)));
    Tmax.getDescription = (_) => Utils.getMath(getDesc(Tmax.level));
    Tmax.getInfo = (amount) => Utils.getMathTo(getInfo(Tmax.level), getInfo(Tmax.level + amount))
    Tmax.bought = () => theory.invalidateTertiaryEquation();
  }

  systemDt = 0.01;
  setPoint = 100;
  updateAvailability();
}

var updateAvailability = () => {
  kickT.isAvailable = autoKick.level == 0;
}

var getTau = () => rho.value.pow(0.33);

/**
 * Performs a single update tick by updating all currencies.
 * @param {number} elapsedTime - Real elapsed time since last tick
 * @param {number} multiplier - Multiplier to the elapsed time to account for rewards. (either 1 or 1.5)
 */
var tick = (elapsedTime, multiplier) => {
  let dt = BigNumber.from(elapsedTime * multiplier);
  let bonus = theory.publicationMultiplier;
  let error = T - setPoint;
  let proportional = error;
  let derivative = (error - prevError) / systemDt
  let valveTarget = 0;
  integral += error * systemDt;

  if (Math.abs(error) <= getTolerance(toleranceReduction.level)){
    output = 0;
  }
  else {
    output = -kp * (proportional + 1 / ti * integral + td * derivative);
  }

  if (output > 100){
    valveTarget = 1;
  }
  else if (output < -100){
    valveTarget = -1;
  }
  else{
    valveTarget = output/100;
  }

  let dT = 0;
  log(output);
  valve = valveTarget + (valve - valveTarget)*BigNumber.E.pow(-dt);
  let prevT = T;
  if (valve > 0) {
    T = getTh(Th.level) - (getTh(Th.level) - T)*BigNumber.E.pow(-1*getC2(c2.level)*Math.abs(valve)*dt)
  }
  else if (valve < 0) {
    T = (T - getTc(Tc.level)) * BigNumber.E.pow(-1 * getC2(c2.level) * Math.abs(valve) * dt) + getTc(Tc.level);
  }
  
  dT = (T-prevT)/dt
  rho.value += bonus * Math.sqrt(getC1(c1.level).pow(1 + c1Exponent.level*0.05) * Math.pow(dT, 2)) * dt;

  // reset integral error when system converges
  if (dT < 0.001){
    integral = 0;
  }

  timer += dt;
  if (timer > frequency && autoKickerEnabled == true) {
    T = amplitude;
    timer = 0;
  }

  if (T > getTmax(Tmax.level)) {
    //resetStage();
  }

  prevError = error;
  theory.invalidateTertiaryEquation();
}

/**
 * Main formula.
 * @returns {String} LaTeX equation
 */
var getPrimaryEquation = () => {
  theory.primaryEquationHeight = 150;
  let result = "\\begin{matrix}"
  result += "e(t) = T_{sp} - T \\\\";
  result += "u(t) = K_p(e(t) + \\frac{1}{t_i}\\int_{0}^{t}e(\\tau)d\\tau \\ + t_d \\frac{d}{dt}e(t))";
  result += "\\\\ \\dot{T} = \\left\\{ \\begin{array}{cl} Q_{h}\\alpha & : \\ u(t) > 0, \\ Q_h = c_2(T_h - T) \\\\ Q_{c}\\alpha & : \\ u(t) < 0, \\ Q_c = c_3(T-T_c)  \\end{array} \\right.";
  result += "\\\\ \\dot{\\rho} = \\sqrt{c_1";
  if (c1Exponent.level >0) {
    let exponent = 1 + c1Exponent.level*0.05
    result += "^{"+ exponent +"}";
  }
  result += "\\dot{T}^2}";
  result += "\\end{matrix}"
  return result;
}


var getInternalState = () => `${T.toString()} ${prevError.toString()} ${integral.toString()} ${kp.toString()} ${ti.toString()} ${td.toString()} ${valve.toString()}`;

var setInternalState = (state) => {
  debug = state;
  let values = state.split(" ");
  if (values.length > 0) T = parseFloat(values[0]);
  if (values.length > 1) prevError = parseFloat(values[1]);
  if (values.length > 2) integral = parseFloat(values[2]);
  if (values.length > 3) kp = parseFloat(values[3]);
  if (values.length > 4) ti = parseFloat(values[4]);
  if (values.length > 5) td = parseFloat(values[5]);
  if (values.length > 6) valve = parseFloat(values[6]);
}


var resetStage = () => {
  T = BigNumber.from(100);
  setPoint = BigNumber.from(100);
  prevError = BigNumber.ZERO;
  integral = BigNumber.ZERO;
  rho.value = BigNumber.ZERO;
  c1.level = 0;
  c2.level = 0;
  c3.level = 0;
  Th.level = 0;
  Tc.level = 0;
  Tmax.level = 0;
  kickT.level = 0;
}

var getC1 = (level) => BigNumber.TWO.pow(level);
var getC2 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 1);
var getC3 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 1);
var getTh = (level) => 140 + ThStepSize * level;
var getTc = (level) => 60 + TcStepSize * level;
var getTmax = (level) => 600 + ThStepSize * level;
var getTolerance = (level) => parseFloat(baseTolerance * BigNumber.TEN.pow(-parseInt(level)));
var getSecondaryEquation = () => theory.latexSymbol + "=\\max\\rho^{0.33} , \\ K_p =" + kp + ",\\ t_i =" + ti + ",\\ t_d =" + td + "\, \\ T_{max} =" + getTmax(Tmax.level);
var getTertiaryEquation = () => "T =" + Math.fround(T).toPrecision(5) + ",\\ T_{sp} =" + setPoint + ",\\ e(t) = " + Math.fround(prevError).toPrecision(3) + ", \\ \\alpha =" + Math.fround(valve).toPrecision(2) + ", \\ \\epsilon =" + getTolerance(toleranceReduction.level);

var get2DGraphValue = () => (BigNumber.ONE + T).toNumber();

var updatePidValues = () => {
  if (newKp > 0 && newTd > 0 && newTi > 0) {
    kp = Number(newKp);
    td = Number(newTd);
    ti = Number(newTi);
    theory.invalidateSecondaryEquation();
  }
}

var newKp, newTi, newTd;

// Flag set to unlock the 'auto kicker'
var canGoToPreviousStage = () => autoKick.level > 0;
// Flag set to unlock PID configuration
var canGoToNextStage = () => changePidValues.level > 0;

const createAutoKickerMenu = () => {
  let menu = ui.createPopup({
    title: "Automatically Adjust T",
    content: ui.createStackLayout({
      children: [
        ui.createLabel({ text: "Value to set T. Maximum: " + getTmax(Tmax.level) }),
        ui.createEntry({
          placeholder: amplitude.toString(),
          onTextChanged: (_, text) => (text > Tmax) ? amplitude = Tmax : (text < -273.15) ? amplitude = -273.15 : amplitude = parseFloat(text),
        }),
        ui.createLabel({ text: "Frequency in seconds:" }),
        ui.createEntry({
          placeholder: frequency.toString(),
          onTextChanged: (_, text) => frequency = parseFloat(text),
        }),
        ui.createLabel({ text: "On/Off" }),
        ui.createCheckBox({
          isChecked: autoKickerEnabled,
          onCheckedChanged: () => autoKickerEnabled = !autoKickerEnabled,
        })
      ]
    })
  })
  return menu;
}
const createPidMenu = () => {
  let menu = ui.createPopup({
    title: "Configure PID",
    content: ui.createStackLayout({
      children: [
        ui.createLatexLabel({ text: Utils.getMath("K_p") }),
        ui.createEntry({
          placeholder: kp.toString(),
          onTextChanged: (_, text) => newKp = text,
        }),
        ui.createLatexLabel({ text: Utils.getMath("t_i") }),
        ui.createEntry({
          placeholder: ti.toString(),
          onTextChanged: (_, text) => newTi = text,
        }),
        ui.createLatexLabel({ text: Utils.getMath("t_d") }),
        ui.createEntry({
          placeholder: td.toString(),
          onTextChanged: (_, text) => newTd = text,
        }),
        ui.createButton({ text: "Update", onClicked: updatePidValues })
      ]
    })
  })
  return menu;
}

var goToNextStage = () => {
  var pidMenu = createPidMenu();
  pidMenu.show();
};

var goToPreviousStage = () => {
  var autoKickMenu = createAutoKickerMenu();
  autoKickMenu.show();
}

init();