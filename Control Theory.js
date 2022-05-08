import { ExponentialCost, FirstFreeCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { parseBigNumber, BigNumber } from "../api/BigNumber";
import { theory } from "../api/Theory";
import { Utils } from "../api/Utils";

var id = "control_theory";
var name = "Control Theory";
var description = "Control Theory is a tool used in engineering to maintain a variable at a set value (known as the 'set point'). \n \n In this theory, you will be attempting to do the opposite - cause as much disturbance in the variable 'T' as possible while a controller attempts to stabilise the value to the set point. \n \n The controller works by calculating the error, e(t) between T and the set point, T_sp. The controller used in this theory will be a PID -- proportional, integral and derivative controller. K_p represents the proportional gain of the system - in other words how much the output changes depending on the error sum within the brackets. The integral term sums up the past errors and attempts to minimise the error after t_i seconds. The derivative term attempts to predict the future error after t_d seconds based on the current derivative of e(t). \n \n For this example, you will assume that this is a heating controller system. The PID controller will adjust the heater so that T reaches the set point. For the purpose of the simulation, u(t) will be considered as a percentage change, in the real world this would correspond to opening a valve to allow heating/cooling fluid to change the temperature. \n \n To make progress, you will need to disturb T to change rho, however going over a certain threshold will reset your progress. At some point you will also be able to manually change the values k_p, t_i, t_d to explore the system more deeply and to improve rho gain.";
var authors = "Gaunter#7599, peanut#6368";
var version = 1.1;
var publicationExponent = 0.33;
var achievements;

// Currency
var rho;
var ThStepSize = 10;
var TcStepSize = -2;

// System variables
var r, T, output, kp, td, ti, setPoint, prevError, integral, systemDt, valve, timer, amplitude, frequency, autoKickerEnabled, baseTolerance, achievementMultiplier, publicationCount;
timer = 0;
frequency = 1;
T = BigNumber.from(100);
r = BigNumber.from(1)
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
achievementMultiplier = 1;
publicationCount = 0;

// Upgrades
var c1, Th, Tc, r1, r2, kickT, Tmax, changePidValues, autoKick, achievementMultiplierUpgrade;

// Milestones
var c1Exponent, rExponent, toleranceReduction;


var init = () => {
  rho = theory.createCurrency();

  /////////////////////
  // Milestone Upgrades

  theory.setMilestoneCost(new LinearCost(15, 15));
  {
    c1Exponent = theory.createMilestoneUpgrade(0, 3);
    c1Exponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("c1", 0.05)
    c1Exponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("c1", "0.05")
    c1Exponent.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
  }

  {
    rExponent = theory.createMilestoneUpgrade(1, 3);
    rExponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("r1", 0.05); // change this to your liking
    rExponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("r1", "0.05");
    rExponent.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
  }

  {
    toleranceReduction = theory.createMilestoneUpgrade(2, 2);
    toleranceReduction.getInfo = (level) => Utils.getMathTo("\\epsilon" , getTolerance(level));
    toleranceReduction.getDescription = (level) => Utils.getMath("\\epsilon = " + getTolerance(level))
    toleranceReduction.boughtOrRefunded = (_) => updateAvailability();
  }


  /////////////////////
  // Permanent Upgrades

  // T Autokick
  {
    autoKick = theory.createPermanentUpgrade(0, rho, new LinearCost(1e3, 0));
    autoKick.maxLevel = 1;
    autoKick.getDescription = (_) => "Automatically adjust T";
    autoKick.getInfo = (_) => "Automatically adjusts T";
  }

  theory.createPublicationUpgrade(1, rho, 1e6);

  // PID Menu Unlock
  {
    changePidValues = theory.createPermanentUpgrade(2, rho, new LinearCost(1e8, 0));
    changePidValues.maxLevel = 1;
    changePidValues.getDescription = (_) => Localization.getUpgradeUnlockDesc("\\text{PID Menu}");
    changePidValues.getInfo = (_) => Localization.getUpgradeUnlockInfo("\\text{PID Menu}");
  }

  theory.createBuyAllUpgrade(3, rho, 1e10);
  theory.createAutoBuyerUpgrade(4, rho, 1e20);

  // Achievement Multiplier
  {
    achievementMultiplierUpgrade = theory.createPermanentUpgrade(5, rho, new LinearCost (1e50, 0))
    achievementMultiplierUpgrade.maxLevel = 1;
    achievementMultiplierUpgrade.getDescription = (_) => "Achievement multiplier"
    achievementMultiplierUpgrade.getInfo = (_) => "Multiplies income by " + achievementMultiplier.toPrecision(3);
  }

  // Kick T
  {
    kickT = theory.createUpgrade(0, rho, new FreeCost())
    kickT.getDescription = (_) => Utils.getMath("T=125");
    kickT.getInfo = (_) => Utils.getMathTo("T=" + T, "T=125");
    kickT.bought = (_) => T = amplitude;
  }


  /////////////////////
  // Upgrades

  // c1
  {
    let getDesc = (level) => "c_1=2^{" + level + "}";
    let getInfo = (level) => "c_1=" + getC1(level).toString(0);
    c1 = theory.createUpgrade(1, rho, new ExponentialCost(3000, Math.log2(3)));
    c1.getDescription = (_) => Utils.getMath(getDesc(c1.level));
    c1.getInfo = (amount) => Utils.getMathTo(getInfo(c1.level), getInfo(c1.level + amount));
  }

  // r1
  {
    let getDesc = (level) => "r_1=" + Utils.getStepwisePowerSum(level, 2, 10, 0).toString(0);
    let getInfo = (level) => "r_1=" + Utils.getStepwisePowerSum(level, 2, 10, 0).toString(0);
    r1 = theory.createUpgrade(2, rho, new ExponentialCost(10, Math.log2(3)));
    r1.getDescription = (_) => Utils.getMath(getDesc(r1.level));
    r1.getInfo = (amount) => Utils.getMathTo(getInfo(r1.level), getInfo(r1.level + amount));
  }

  // r2
  {
    let getDesc = (level) => "r_2= 2^{" + level + "}";
    let getInfo = (level) => "r_2=" + getR2(level).toString(0);
    r2 = theory.createUpgrade(3, rho, new ExponentialCost(15, Math.log2(8)));
    r2.getDescription = (_) => Utils.getMath(getDesc(r2.level));
    r2.getInfo = (amount) => Utils.getMathTo(getInfo(r2.level), getInfo(r2.level + amount));
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

  /////////////////////
  // Achievements

  let achievement_category1 = theory.createAchievementCategory(0, "Temperature");
  let achievement_category2 = theory.createAchievementCategory(1, "Milestones");
  let achievement_category3 = theory.createAchievementCategory(2, "Publications");

  achievements = [

    // Temperature
    theory.createAchievement(0, achievement_category1, "Hotter than the sun", "Have T exceed 5500.", () => T > BigNumber.from(5500)),
    theory.createAchievement(1, achievement_category1, "Sub-zero", "Have T plummet below 0.", () => T < BigNumber.from(0)),
    theory.createAchievement(2, achievement_category1, "Absolute 0", "Have T plummet below -273.", () => T < BigNumber.from(-273)),

    // Milestones
    theory.createAchievement(3, achievement_category2, "Junior Engineer", "Reach 1e10τ.", () => theory.tau > BigNumber.from(1e10)),
    theory.createAchievement(4, achievement_category2, "Senior Engineer", "Reach 1e25τ.", () => theory.tau > BigNumber.from(1e25)),
    theory.createAchievement(5, achievement_category2, "Prinicipal Engineer", "Reach 1e50τ.", () => theory.tau > BigNumber.from(1e50)),
    theory.createAchievement(6, achievement_category2, "Googol Engineer", "Reach 1e100τ.", () => theory.tau > BigNumber.from(1e100)),

    // Publications
    theory.createAchievement(7, achievement_category3, "Research Intern", "Publish 5 times.", () => publicationCount >= 5),
    theory.createAchievement(8, achievement_category3, "R&D Engineer", "Publish 10 times.", () => publicationCount >= 10),
    theory.createAchievement(9, achievement_category3, "\"That's Dr., not Mr.\"", "Publish 25 times.", () => publicationCount >= 25),
  ];
  updateAvailability();
}

{
  // Internal
  var calculateAchievementMultiplier = () => {
    let count = 0;
    for (const achievement of achievements) {
      if (achievement.isUnlocked) {
        count++
      }
    }
    achievementMultiplier = Math.pow(2, (0.1*count));
  }

  var updateAvailability = () => {
    kickT.isAvailable = autoKick.level == 0;
  }

  var getInternalState = () => `${T.toString()} ${prevError.toString()} ${integral.toString()} ${kp.toString()} ${ti.toString()} ${td.toString()} ${valve.toString()} ${publicationCount.toString()} ${r}`;

  var setInternalState = (state) => {
    debug = state;
    let values = state.split(" ");
    if (values.length > 0) T = BigNumber.from(parseFloat(values[0]));
    if (values.length > 1) prevError = parseFloat(values[1]);
    if (values.length > 2) integral = parseFloat(values[2]);
    if (values.length > 3) kp = parseFloat(values[3]);
    if (values.length > 4) ti = parseFloat(values[4]);
    if (values.length > 5) td = parseFloat(values[5]);
    if (values.length > 6) valve = parseFloat(values[6]);
    if (values.length > 7) publicationCount = parseFloat(values[7])
    if (values.length > 8) r = BigNumber.from(parseFloat(values[8]));
  }

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
          ui.createLabel({text: "Value to set T. Maximum: " + getTmax(Tmax.level)}),
          ui.createEntry({
            placeholder: amplitude.toString(),
            onTextChanged: (_, text) => {
              if (text == "" || !parseFloat(text)) amplitude = 100;
              (text > Tmax) ? amplitude = Tmax : (text < -273.15) ? amplitude = -273.15 : amplitude = parseFloat(text);
            }
          }),
          ui.createLabel({text: "Frequency in seconds:"}),
          ui.createEntry({
            placeholder: frequency.toString(),
            onTextChanged: (_, text) => frequency = parseFloat(text),
          }),
          ui.createLabel({text: "Off/On"}),
          ui.createSwitch({
            isToggled: () => autoKickerEnabled,
            onTouched: (e) => {if (e.type == TouchType.PRESSED) autoKickerEnabled = !autoKickerEnabled},
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
          ui.createLatexLabel({text: Utils.getMath("K_p")}),
          ui.createEntry({
            placeholder: kp.toString(),
            onTextChanged: (_, text) => newKp = text,
          }),
          ui.createLatexLabel({text: Utils.getMath("t_i")}),
          ui.createEntry({
            placeholder: ti.toString(),
            onTextChanged: (_, text) => newTi = text,
          }),
          ui.createLatexLabel({text: Utils.getMath("t_d")}),
          ui.createEntry({
            placeholder: td.toString(),
            onTextChanged: (_, text) => newTd = text,
          }),
          ui.createButton({text: "Update", onClicked: updatePidValues})
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

  var tick = (elapsedTime, multiplier) => {
    calculateAchievementMultiplier();
    let dt = BigNumber.from(elapsedTime * multiplier);
    let bonus = theory.publicationMultiplier;
    if (achievementMultiplierUpgrade.level > 0) bonus *= achievementMultiplier;
    let error = T - setPoint;
    let proportional = error;
    let derivative = (error - prevError) / systemDt
    let valveTarget = 0;
    integral += error * systemDt;

    if (Math.abs(error) <= getTolerance(toleranceReduction.level)) {
      output = 0;
    } else {
      output = -kp * (proportional + 1 / ti * integral + td * derivative);
    }

    if (output > 100) {
      valveTarget = 1;
    } else if (output < -100) {
      valveTarget = -1;
    } else {
      valveTarget = output / 100;
    }

    let dT = 0;
    valve = valveTarget + (valve - valveTarget) * BigNumber.E.pow(-dt);
    let prevT = T;
    if (valve > 0) {
      T = getTh(Th.level) - (getTh(Th.level) - T) * BigNumber.E.pow(-1 * Math.abs(valve) * dt)
    } else if (valve < 0) {
      T = (T - getTc(Tc.level)) * BigNumber.E.pow(-1 * Math.abs(valve) * dt) + getTc(Tc.level);
    }

    dT = (T - prevT) / dt
    r += getR1(r1.level)*getR2(r2.level)/(1+Math.abs(error)) * dt;

    let value_c1 = getC1(c1.level).pow(getC1Exp(c1Exponent.level));
    let value_r = r.pow(getRExp(rExponent.level))

    rho.value += value_r * Math.sqrt(value_c1 * Math.pow(dT, 2)) * dt * bonus; // use bignumber sqrt and pow, not Math ones, they dont support values above 1e308 - peanut

    // reset integral error when system converges
    if (dT < 0.001) {
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
}


{
  // Equations

  var getPrimaryEquation = () => {
    theory.primaryEquationHeight = 90;
    theory.primaryEquationScale = 1;
    let result = "\\begin{matrix}"

    let c1_exp = c1Exponent.level > 0 ? getC1Exp(c1Exponent.level).toNumber() : "";
    let r1_exp = rExponent.level > 0 ? getRExp(rExponent.level).toNumber() : "";

    result += "\\dot{T} = \\left\\{ \\begin{array}{cl} Q_{h} & : \\ u(t) > 0, \\ Q_h = T_h - T \\\\ Q_{c} & : \\ u(t) < 0, \\ Q_c = T-T_c  \\end{array} \\right.\\\\";

    result += "\\dot{\\rho} = r^{" + r1_exp + "}\\sqrt{c_1^{" + c1_exp +"}\\dot{T}^{2}}";
    result += ", \\;\\dot{r} = \\frac{r_1 r_2}{1+\|e(t)\|}"

    result += "\\end{matrix}"
    return result;
  }

  var getSecondaryEquation = () => {
    theory.secondaryEquationHeight = 75;
    theory.secondaryEquationScale = 0.9;
    let result = "\\begin{array}{c}";
    result += "e(t) = T_{sp} - T \\\\";
    result += "u(t) = K_p(e(t) + \\frac{1}{t_i}\\int_{0}^{t}e(\\tau)d\\tau \\ + t_d \\dot{e(t)})\\\\";
    result += theory.latexSymbol + "=\\max\\rho^{0.33} , \\ K_p =" + kp + ",\\ t_i =" + ti + ",\\ t_d =" + td + "\, \\ T_{max} =" + getTmax(Tmax.level);
    result += "\\end{array}"
    return result;
  }

  var getTertiaryEquation = () => {
    let result = "";
    result += "T =" + Math.fround(T).toPrecision(5);
    result += ",\\,T_{sp} =" + setPoint + ",\\ e(t) = " + Math.fround(prevError).toPrecision(3);
    result += ",\\,\\epsilon =" + getTolerance(toleranceReduction.level);
    result += ",\\, r ="+ r;
    return result;
  }
}

var getC1Exp = (level) => BigNumber.from(1 + c1Exponent.level * 0.05);
var getRExp = (level) => BigNumber.from(1 + rExponent.level * 0.05);

var getC1 = (level) => BigNumber.TWO.pow(level);
var getR1 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 0);
var getR2 = (level) => BigNumber.TWO.pow(level)-1;
var getTh = (level) => 140 + ThStepSize * level;
var getTc = (level) => 60 + TcStepSize * level;
var getTmax = (level) => 600 + ThStepSize * level;
var getTolerance = (level) => parseFloat(baseTolerance * BigNumber.TEN.pow(-parseInt(level)));
var getPublicationMultiplier = (tau) => achievementMultiplier * tau.pow(publicationExponent);
var getPublicationMultiplierFormula = (symbol) => (achievementMultiplier > 1 ? BigNumber.from(achievementMultiplier).toString(2) + "\\times" : "") + "{" + symbol + "}^{" + publicationExponent + "}";
var get2DGraphValue = () => (BigNumber.ONE + T).toNumber();
var getTau = () => rho.value.pow(0.33);
var getCurrencyFromTau = (tau) => [tau.max(BigNumber.ONE).pow(0.33), rho.symbol];
var postPublish = () => publicationCount++;

init();
