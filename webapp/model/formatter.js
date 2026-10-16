sap.ui.define([
  "sap/ui/core/format/NumberFormat"
], function (NumberFormat) {
  "use strict";

  return {
    /**
     * Formats amounts with 2 decimal places without currency unit
     */
    formatCurrency: function (fValue, sCurrency) {
      if (fValue === undefined || fValue === null || isNaN(fValue)) {
        return "0.00";
      }
      var oFormat = NumberFormat.getFloatInstance({
        minFractionDigits: 2,
        maxFractionDigits: 2,
        groupingEnabled: true
      });
      return oFormat.format(Number(fValue));
    },

    /**
     * Maps address status to ValueState for ObjectStatus / ObjectMarker
     */
    addressStatusState: function (sStatus) {
      switch (sStatus) {
        case "EXISTING":
          return "Success";
        case "MODIFIED":
          return "Warning";
        case "NEW":
          return "Information";
        case "VERIFIED":
          return "Information";
        case "USED BEFORE":
          return "None";
        default:
          return "None";
      }
    },

    /**
     * Returns true if status is EXISTING
     */
    isExistingStatus: function (sStatus) {
      return sStatus === "EXISTING";
    },

    /**
     * Quantity multiplier string for display
     */
    formatQtyMultiplier: function (nQty, fPrice) {
      if (!nQty || !fPrice) return "";
      return nQty + " × " + this.formatCurrency(fPrice);
    },

    /**
     * Formats plain price without currency prefix (e.g. 1000 or 499.83)
     */
    formatPriceOnly: function (fValue) {
      if (fValue === undefined || fValue === null || isNaN(fValue)) {
        return "0";
      }
      var n = Number(fValue);
      return (n % 1 === 0) ? String(n) : n.toFixed(2);
    },

    /**
     * Formats quantity with 3 decimal places (e.g. 870.000)
     */
    formatQtyDecimal: function (nQty) {
      if (nQty === undefined || nQty === null || isNaN(nQty)) {
        return "1.000";
      }
      return Number(nQty).toFixed(3);
    },

    /**
     * Maps sourcing state to icon
     */
    sourcingStatusIcon: function (sState) {
      switch (sState) {
        case "Success":
          return "sap-icon://sys-enter-2";
        case "Warning":
          return "sap-icon://alert";
        case "Error":
          return "sap-icon://error";
        case "Information":
          return "sap-icon://information";
        default:
          return "sap-icon://shipping-status";
      }
    },

    /**
     * Maps article status to badge state
     */
    articleStatusState: function (sStatus) {
      if (sStatus === "M") {
        return "Information";
      } else if (sStatus === "Not M") {
        return "Warning";
      } else if (sStatus === "NLAG") {
        return "None";
      }
      return "None";
    },

    /**
     * Maps sourcing state to status color hex for status flag / color icon
     */
    sourcingStatusColor: function (sState) {
      switch (sState) {
        case "Success":
          return "#107e3e";
        case "Warning":
          return "#e9730c";
        case "Error":
          return "#bb0000";
        case "Information":
          return "#0070f2";
        default:
          return "#6a6d70";
      }
    }
  };
});
