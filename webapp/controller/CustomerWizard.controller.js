sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Fragment",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/m/MessagePopover",
  "sap/m/MessageItem",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/salesorder/store/model/models",
  "sap/m/StepInput",
  "sap/ui/salesorder/store/utils/BasicDetailsValidation"
], function (BaseController, JSONModel, Fragment, MessageToast, MessageBox, MessagePopover, MessageItem, Filter, FilterOperator, models, StepInput, BasicDetailsValidation) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.CustomerWizard", {
    onInit: function () {
      var oWizardModel = new JSONModel({
        searchPanelExpanded: true,
        showNewCustomerCapture: false,
        isCreatingNewCustomer: false,
        customerSelected: false,
        addressValidated: false,
        isNewlyCreatedCustomer: false,
        newCustomerTypeIndex: 0,
        searchCriteria: {
          customerName: "",
          mobile: "",
          email: ""
        },
        productSearchQuery: "",
        selectedCategory: "All",
        orderCreated: false
      });
      this.getView().setModel(oWizardModel, "wizardModel");

      // Ensure Step 1 is unvalidated until customer is selected or created
      var oStepCustomer = this.byId("stepCustomer");
      if (oStepCustomer) {
        oStepCustomer.setValidated(false);
      }

      // Ensure Step 2 is unvalidated until 1st dropdown value is selected
      var oStepConsent = this.byId("stepConsent");
      if (oStepConsent) {
        var sMarketToYou = this.getModel("appState").getProperty("/marketing/marketToYou");
        oStepConsent.setValidated(!!sMarketToYou);
      }

      // Ensure pricing is initialized
      this.recalculateTotals();
      this._updatePendingActionText();

      // Setup DatePicker limits (must be at least 18 years old)
      this._setupDatePickerLimits();

      // Initialize messages model for MessagePopover
      var oMessageModel = new JSONModel([]);
      this.getView().setModel(oMessageModel, "messages");

      var that = this;
      this._oMessagePopover = new MessagePopover({
        activeTitlePress: function (oEvt) {
          var oItem = oEvt.getParameter("item");
          var oBindingContext = oItem.getBindingContext("messages");
          if (oBindingContext) {
            var sControlId = oBindingContext.getProperty("controlId");
            if (sControlId) {
              var oCtrl = that.byId(sControlId);
              if (oCtrl && oCtrl.focus) {
                oCtrl.focus();
              }
            }
          }
        },
        items: {
          path: "messages>/",
          template: new MessageItem({
            type: "{messages>type}",
            title: "{messages>title}",
            description: "{messages>description}",
            subtitle: "{messages>subtitle}"
          })
        }
      });
      this.getView().addDependent(this._oMessagePopover);
    },

    onAfterRendering: function () {
      this._attachDeliveryCardEvents();
    },

    _attachDeliveryCardEvents: function () {
      var that = this;
      var fnAttach = function (sId, fnHandler) {
        var oCard = that.byId(sId);
        if (oCard) {
          oCard.attachBrowserEvent("click", fnHandler);
          var oDom = oCard.getDomRef();
          if (oDom) {
            oDom.onclick = fnHandler;
          }
        }
      };

      fnAttach("cardCND", function () { that.onSelectDeliveryCND(); });
      fnAttach("cardCNC", function () { that.onSelectClickAndCollectCNC(); });
      fnAttach("cardCNP", function () { that.onSelectBopisCNP(); });
    },

    _setupDatePickerLimits: function () {
      var dToday = new Date();
      var dMaxDate = new Date(dToday.getFullYear() - 18, dToday.getMonth(), dToday.getDate());

      var oDpComp = this.byId("dpCompanyDob");
      if (oDpComp && oDpComp.setMaxDate) {
        oDpComp.setMaxDate(dMaxDate);
      }
      var oDpInd = this.byId("dpIndivDob");
      if (oDpInd && oDpInd.setMaxDate) {
        oDpInd.setMaxDate(dMaxDate);
      }
    },

    // ========================================================
    // STEP 1: CUSTOMER LOOKUP & CAPTURE
    // ========================================================
    onSearchCustomerClick: function () {
      var oWizardModel = this.getView().getModel("wizardModel");
      var oCriteria = oWizardModel.getProperty("/searchCriteria") || {};
      var sName = (oCriteria.customerName || "").trim();
      var sMobile = (oCriteria.mobile || "").trim();
      var sEmail = (oCriteria.email || "").trim();

      // No validation required: if no criteria provided, display all customer records
      this.getModel("appState").setProperty("/searchFilterValue", sName);
      this._openSearchResultsDialog(sName, sMobile, sEmail);
    },

    _openSearchResultsDialog: function (sName, sMobile, sEmail) {
      var oView = this.getView();
      var that = this;

      if (!this._pResultsDialog) {
        this._pResultsDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.CustomerSearchResultsDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        });
      }

      this._pResultsDialog.then(function (oDialog) {
        var oTable = Fragment.byId(oView.getId(), "customerResultsTable");
        var oBinding = oTable.getBinding("items");
        var aFilters = [];

        if (sName) {
          aFilters.push(new Filter("name", FilterOperator.Contains, sName));
        }
        if (sMobile) {
          aFilters.push(new Filter("telephone", FilterOperator.Contains, sMobile));
        }
        if (sEmail) {
          aFilters.push(new Filter("email", FilterOperator.Contains, sEmail));
        }

        if (aFilters.length > 0) {
          oBinding.filter(new Filter({ filters: aFilters, and: false }));
        } else {
          // If no search criteria provided, display all data
          oBinding.filter([]);
        }

        var aItems = oTable.getItems();
        if (aItems.length > 0) {
          oTable.setSelectedItem(aItems[0]);
          that._selectedCustomerContext = aItems[0].getBindingContext("customers");
        } else {
          that._selectedCustomerContext = null;
        }
        oDialog.open();
      });
    },

    onSelectCustomerRow: function (oEvent) {
      var oListItem = oEvent.getParameter("listItem");
      this._selectedCustomerContext = oListItem.getBindingContext("customers");
    },

    onLiveSearchDialog: function (oEvent) {
      var sValue = oEvent.getParameter("value");
      var oTable = Fragment.byId(this.getView().getId(), "customerResultsTable");
      var oBinding = oTable.getBinding("items");

      if (sValue) {
        var aFilters = [
          new Filter("name", FilterOperator.Contains, sValue),
          new Filter("bpNumber", FilterOperator.Contains, sValue),
          new Filter("telephone", FilterOperator.Contains, sValue),
          new Filter("email", FilterOperator.Contains, sValue)
        ];
        oBinding.filter(new Filter({ filters: aFilters, and: false }));
      } else {
        oBinding.filter([]);
      }
    },

    onConfirmCustomerSelection: function () {
      if (!this._selectedCustomerContext) {
        var oTable = Fragment.byId(this.getView().getId(), "customerResultsTable");
        var aItems = oTable.getItems();
        if (aItems.length > 0) {
          this._selectedCustomerContext = aItems[0].getBindingContext("customers");
        }
      }

      if (this._selectedCustomerContext) {
        var oCustomerData = this._selectedCustomerContext.getObject();
        var oAppState = this.getModel("appState");
        oAppState.setProperty("/customer", JSON.parse(JSON.stringify(oCustomerData)));
        oAppState.setProperty("/orderHeader/soldToParty", oCustomerData.bpNumber + " - " + oCustomerData.name);
        oAppState.setProperty("/orderHeader/shipToParty", oCustomerData.bpNumber + " - " + oCustomerData.name);
        oAppState.setProperty("/delivery/address", oCustomerData.address);
        MessageToast.show("Customer " + oCustomerData.name + " (BP " + oCustomerData.bpNumber + ") selected");
      }

      this.onCloseSearchResultsDialog();
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/showNewCustomerCapture", false);
      oWizardModel.setProperty("/isCreatingNewCustomer", false);
      oWizardModel.setProperty("/isNewlyCreatedCustomer", false);
      oWizardModel.setProperty("/customerSelected", true);
      oWizardModel.setProperty("/addressValidated", true);
      oWizardModel.setProperty("/searchPanelExpanded", false);

      var oStepCustomer = this.byId("stepCustomer");
      if (oStepCustomer) {
        oStepCustomer.setValidated(true);
      }
      var oWizard = this.byId("salesOrderWizard");
      if (oWizard && oStepCustomer) {
        oWizard.validateStep(oStepCustomer);
      }
    },

    onCustomerNotFound: function () {
      this.onCloseSearchResultsDialog();
      this.onShowCustomerNotFoundCapture();
    },

    onCloseSearchResultsDialog: function () {
      if (this._pResultsDialog) {
        this._pResultsDialog.then(function (oDialog) {
          oDialog.close();
        });
      }
    },

    onClearSearchCriteria: function () {
      this.getView().getModel("wizardModel").setProperty("/searchCriteria", {
        customerName: "",
        mobile: "",
        email: ""
      });
    },

    onShowCustomerNotFoundCapture: function () {
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/isCreatingNewCustomer", true);
      oWizardModel.setProperty("/customerSelected", false);
      oWizardModel.setProperty("/addressValidated", false);
      oWizardModel.setProperty("/isNewlyCreatedCustomer", false);
      oWizardModel.setProperty("/showNewCustomerCapture", false);

      var oAppState = this.getModel("appState");
      var oCriteria = oWizardModel.getProperty("/searchCriteria") || {};
      var sCriteriaName = (oCriteria.customerName || "").trim();
      var aNames = sCriteriaName.split(" ");
      var sFirst = aNames[0] || "";
      var sLast = aNames.slice(1).join(" ") || "";

      var oDraft = {
        bpNumber: "",
        name: sCriteriaName || "",
        firstName: sFirst,
        lastName: sLast,
        title: "Mr.",
        telephone: oCriteria.mobile || "",
        email: oCriteria.email || "",
        type: "Individual",
        dateOfBirth: "",
        gender: "Male",
        idType: "SA ID Number",
        idPassport: oCriteria.idNumber || "",
        companyName: sCriteriaName || "",
        regNo: "",
        vatNo: "",
        authRepTitle: "Mr.",
        authRepFirstName: sFirst,
        authRepSurname: sLast,
        contactPerson: sCriteriaName || "",
        language: "English",
        salesOrg: "1000",
        distChannel: "10",
        division: "00",
        address: {
          street: "",
          city: "",
          postalCode: "",
          region: "",
          country: "ZA",
          formatted: "",
          type: "Default / Billing",
          status: "",
          statusState: "None"
        }
      };

      oAppState.setProperty("/customer", oDraft);

      var oStepCustomer = this.byId("stepCustomer");
      if (oStepCustomer) {
        oStepCustomer.setValidated(false);
      }
      MessageToast.show("Please enter Customer Basic Details and validate Address");
    },

    onCancelNewCustomer: function () {
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/showNewCustomerCapture", false);
      oWizardModel.setProperty("/isCreatingNewCustomer", false);
      oWizardModel.setProperty("/customerSelected", false);
      oWizardModel.setProperty("/addressValidated", false);
      oWizardModel.setProperty("/isNewlyCreatedCustomer", false);

      var oStepCustomer = this.byId("stepCustomer");
      if (oStepCustomer) {
        oStepCustomer.setValidated(false);
      }
      MessageToast.show("Cancelled new customer creation");
    },

    onSelectEntityTypeIndividual: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/customer/type", "Individual");
      this._clearAllBasicDetailsControlStates();
      this.onUpdateCustomerName();
    },

    onSelectEntityTypeCompany: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/customer/type", "Company");
      this._clearAllBasicDetailsControlStates();
      this.onUpdateCustomerName();
    },

    onNameLiveChange: function (oEvent) {
      var oSource = oEvent.getSource();
      var sVal = oEvent.getParameter("value") || "";
      var sClean = sVal.replace(/[^a-zA-Z\s.'-]/g, "");
      if (sVal !== sClean) {
        oSource.setValue(sClean);
      }
      var oBinding = oSource.getBinding("value");
      if (oBinding) {
        oBinding.setValue(sClean);
      }
      this.onUpdateCustomerName();
      if (oSource.getValueState && oSource.getValueState() === "Error") {
        this._validateBasicDetailsForm(true);
      }
    },

    onMobileLiveChange: function (oEvent) {
      var oSource = oEvent.getSource();
      var sVal = oEvent.getParameter("value") || "";
      var sClean = sVal.replace(/[^\d]/g, "").slice(0, 10);
      if (sVal !== sClean) {
        oSource.setValue(sClean);
      }
      var oBinding = oSource.getBinding("value");
      if (oBinding) {
        oBinding.setValue(sClean);
      }
      if (oSource.getValueState && oSource.getValueState() === "Error") {
        this._validateBasicDetailsForm(true);
      }
    },

    onIdNoLiveChange: function (oEvent) {
      var oSource = oEvent.getSource();
      var sVal = oEvent.getParameter("value") || "";
      var oAppState = this.getModel("appState");
      var sIdType = oAppState ? (oAppState.getProperty("/customer/idType") || "SA ID Number") : "SA ID Number";

      var sClean = sVal;
      if (sIdType === "SA ID Number") {
        sClean = sVal.replace(/[^\d]/g, "").slice(0, 13);
      } else if (sIdType === "Passport") {
        sClean = sVal.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
      } else {
        sClean = sVal.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20);
      }

      if (sVal !== sClean) {
        oSource.setValue(sClean);
      }
      var oBinding = oSource.getBinding("value");
      if (oBinding) {
        oBinding.setValue(sClean);
      }
      if (oSource.getValueState && oSource.getValueState() === "Error") {
        this._validateBasicDetailsForm(true);
      }
    },

    onDobChange: function (oEvent) {
      var oDP = oEvent.getSource();
      var sVal = oEvent.getParameter("value") || oDP.getValue() || "";
      var oAppState = this.getModel("appState");
      if (oAppState) {
        oAppState.setProperty("/customer/dateOfBirth", sVal);
      }
      if (oDP.getValueState && oDP.getValueState() === "Error") {
        this._validateBasicDetailsForm(true);
      }
    },

    onFieldChange: function (oEvent) {
      if (oEvent && oEvent.getSource) {
        var oSource = oEvent.getSource();
        var oBinding = oSource.getBinding && (oSource.getBinding("value") || oSource.getBinding("selectedKey"));
        if (oBinding && oSource.getValue) {
          oBinding.setValue(oSource.getValue());
        }
        if (oSource.getValueState && oSource.getValueState() === "Error") {
          this._validateBasicDetailsForm(true);
        }
      }
    },

    _clearAllBasicDetailsControlStates: function () {
      var aControlIds = [
        "inputCompanyRegName", "inputCompanyRegNo", "inputVatNumber", "dpCompanyDob", "selectCompanyGender",
        "inputCompanyMobile", "selectCompanyTitle", "inputCompanyFirstName", "inputCompanySurname",
        "selectCompanyIdType", "inputCompanyIdNo", "inputCompanyEmail",
        "selectIndivTitle", "inputIndivFirstName", "inputIndivSurname", "dpIndivDob",
        "selectIndivGender", "selectIndivIdType", "inputIndivIdNo", "inputIndivMobile", "inputIndivEmail"
      ];
      var that = this;
      aControlIds.forEach(function (sId) {
        var oCtrl = that.byId(sId);
        if (oCtrl && oCtrl.setValueState) {
          oCtrl.setValueState("None");
          oCtrl.setValueStateText("");
        }
      });
    },

    _validateBasicDetailsForm: function (bSilent) {
      var oAppState = this.getModel("appState");
      var oCustomer = oAppState ? oAppState.getProperty("/customer") : {};
      oCustomer = oCustomer || {};
      var sEntityType = oCustomer.type || "Individual";

      this._clearAllBasicDetailsControlStates();
      this._setupDatePickerLimits();

      var oDpComp = this.byId("dpCompanyDob");
      var oDpInd = this.byId("dpIndivDob");

      var oValidationData = {
        entityType: sEntityType,
        customerName: (sEntityType === "Company" ? oCustomer.companyName : ((oCustomer.firstName || "") + " " + (oCustomer.lastName || ""))) || "",
        companyRegNo: oCustomer.regNo || "",
        vatNumber: oCustomer.vatNo || "",
        dateOfBirth: oCustomer.dateOfBirth || "",
        gender: oCustomer.gender || "",
        mobileNumber: oCustomer.telephone || "",
        emailAddress: oCustomer.email || "",
        title: sEntityType === "Company" ? (oCustomer.authRepTitle || "") : (oCustomer.title || ""),
        firstName: sEntityType === "Company" ? (oCustomer.authRepFirstName || "") : (oCustomer.firstName || ""),
        surname: sEntityType === "Company" ? (oCustomer.authRepSurname || "") : (oCustomer.lastName || ""),
        idType: oCustomer.idType || "SA ID Number",
        idNumber: oCustomer.idPassport || ""
      };

      var aValidationErrors = BasicDetailsValidation.validateBasicDetails(
        oValidationData,
        this.getResourceBundle(),
        {
          bDpCompValid: (sEntityType === "Company" && oDpComp && oDpComp.isValidValue) ? oDpComp.isValidValue() : ((sEntityType === "Individual" && oDpInd && oDpInd.isValidValue) ? oDpInd.isValidValue() : true)
        }
      );

      if (aValidationErrors && aValidationErrors.length > 0) {
        var that = this;
        var oFirstCtrlToFocus = null;

        aValidationErrors.forEach(function (oErr) {
          if (oErr.controlId) {
            var oCtrl = that.byId(oErr.controlId);
            if (oCtrl && oCtrl.setValueState) {
              oCtrl.setValueState("Error");
              oCtrl.setValueStateText(oErr.subtitle || oErr.description);
              if (!oFirstCtrlToFocus && oCtrl.focus) {
                oFirstCtrlToFocus = oCtrl;
              }
            }
          }
        });

        if (!bSilent) {
          var sFirstErrorMsg = aValidationErrors[0].subtitle || aValidationErrors[0].description;
          MessageBox.error(sFirstErrorMsg, {
            title: "Validation Error",
            onClose: function () {
              if (oFirstCtrlToFocus && oFirstCtrlToFocus.focus) {
                oFirstCtrlToFocus.focus();
              }
            }
          });
        }
        return false;
      }

      return true;
    },

    onUpdateCustomerName: function () {
      var oAppState = this.getModel("appState");
      var sType = oAppState.getProperty("/customer/type") || "Individual";
      var sBp = oAppState.getProperty("/customer/bpNumber") || ("10002" + Math.floor(10000 + Math.random() * 90000));
      if (!oAppState.getProperty("/customer/bpNumber")) {
        oAppState.setProperty("/customer/bpNumber", sBp);
      }

      var sName = "";
      if (sType === "Company") {
        sName = oAppState.getProperty("/customer/companyName") || "Company";
      } else {
        var sFirst = oAppState.getProperty("/customer/firstName") || "";
        var sLast = oAppState.getProperty("/customer/lastName") || "";
        sName = (sFirst + " " + sLast).trim() || "New Customer";
      }

      oAppState.setProperty("/customer/name", sName);
      oAppState.setProperty("/orderHeader/soldToParty", sBp + " - " + sName);
      oAppState.setProperty("/orderHeader/shipToParty", sBp + " - " + sName);
    },

    onNewCustomerTypeChange: function (oEvent) {
      var nIndex = oEvent.getParameter("selectedIndex");
      this.getView().getModel("wizardModel").setProperty("/newCustomerTypeIndex", nIndex);
      if (nIndex === 1) {
        this.onSelectEntityTypeCompany();
      } else {
        this.onSelectEntityTypeIndividual();
      }
    },

    onCreateShellBpConfirm: function () {
      this.onUpdateCustomerName();
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/showNewCustomerCapture", false);
      oWizardModel.setProperty("/isCreatingNewCustomer", true);
      this._setupDatePickerLimits();
      this._clearAllBasicDetailsControlStates();
      MessageToast.show("Basic Details ready for customer creation");
    },

    onUpdateFullName: function () {
      this.onUpdateCustomerName();
    },

    onUpdateCompanyName: function () {
      this.onUpdateCustomerName();
    },

    // ========================================================
    // STEP 2: ADDRESS VALIDATION
    // ========================================================
    onOpenAddressPluginModal: function () {
      // 1. Validate basic details of individual or company first based on radio button selection
      var bValid = this._validateBasicDetailsForm(false);
      if (!bValid) {
        return; // Validation failed: errors highlighted, popup NOT opened
      }

      // 2. If all ok, open the address plugin popup!
      var that = this;
      var oAppState = this.getModel("appState");

      this.openAddressValidationDialog("Default (Billing)", function (oSelectedAddress) {
        if (oSelectedAddress) {
          var oAddrObj = {
            street: oSelectedAddress.street || "",
            city: oSelectedAddress.city || "",
            postalCode: oSelectedAddress.postalCode || "",
            region: oSelectedAddress.region || "",
            formatted: oSelectedAddress.formatted || "",
            type: "Default / Billing",
            status: oSelectedAddress.status || "EXISTING",
            statusState: that.formatter.addressStatusState(oSelectedAddress.status)
          };
          oAppState.setProperty("/customer/address", oAddrObj);
          oAppState.setProperty("/delivery/address", oAddrObj);
          that.getView().getModel("wizardModel").setProperty("/addressValidated", true);
          that._updatePendingActionText();
          MessageToast.show("Address validated: " + (oAddrObj.formatted || oAddrObj.status));
        }
      });
    },

    onSelectSuggestedAddress: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      var oSelectedAddress = oItem.getBindingContext("addresses").getObject();
      var oAppState = this.getModel("appState");
      var that = this;

      var oAddrObj = {
        street: oSelectedAddress.street || "",
        city: oSelectedAddress.city || "",
        postalCode: oSelectedAddress.postalCode || "",
        region: oSelectedAddress.region || "",
        formatted: oSelectedAddress.formatted || "",
        type: "Default / Billing",
        status: oSelectedAddress.status || "EXISTING",
        statusState: that.formatter.addressStatusState(oSelectedAddress.status)
      };
      oAppState.setProperty("/customer/address", oAddrObj);
      oAppState.setProperty("/delivery/address", oAddrObj);
      this.getView().getModel("wizardModel").setProperty("/addressValidated", true);
      this._updatePendingActionText();
      MessageToast.show("Selected: " + oAddrObj.formatted);
    },

    onEnterNewAddressInWizard: function () {
      var oAddressesModel = this.getModel("addresses");
      var aAddresses = oAddressesModel.getData() || [];
      var oNewAddr = {
        id: "addr-" + (aAddresses.length + 1),
        street: "88 Grayston Drive",
        city: "Sandton",
        postalCode: "2196",
        region: "Gauteng",
        country: "South Africa",
        formatted: "88 Grayston Drive, Sandton, 2196, Gauteng",
        status: "NEW",
        statusState: "Information",
        note: "Newly entered customer address",
        isDefault: true
      };
      aAddresses.unshift(oNewAddr);
      oAddressesModel.setData(aAddresses);
      this.getModel("appState").setProperty("/customer/address", oNewAddr);
      this.getView().getModel("wizardModel").setProperty("/addressValidated", true);
      this._updatePendingActionText();
      MessageToast.show("New address entered (Status: NEW)");
    },

    onEditAddressInWizard: function () {
      var oAddressesModel = this.getModel("addresses");
      var aAddresses = oAddressesModel.getData() || [];
      if (aAddresses.length > 0) {
        aAddresses[0].street = "12 Rivonia Road, Suite 402";
        aAddresses[0].formatted = "12 Rivonia Road, Suite 402, Sandton, 2196, Gauteng";
        aAddresses[0].status = "MODIFIED";
        aAddresses[0].statusState = "Warning";
        aAddresses[0].note = "Modified by agent: Suite number added";
        oAddressesModel.setData(aAddresses);
        this.getModel("appState").setProperty("/customer/address", aAddresses[0]);
        this.getView().getModel("wizardModel").setProperty("/addressValidated", true);
        this._updatePendingActionText();
        MessageToast.show("Address modified (Status: MODIFIED)");
      }
    },

    onExecuteCreateCustomer: function () {
      var oAppState = this.getModel("appState");
      var oCustomer = oAppState.getProperty("/customer") || {};
      var sType = oCustomer.type || "Individual";

      // Form validation
      if (!this._validateBasicDetailsForm(false)) {
        return;
      }

      // Check address
      if (!oCustomer.address || !oCustomer.address.formatted) {
        MessageBox.warning("Please validate or select an address before creating customer.");
        return;
      }

      // Customer name computation
      var sName = "";
      if (sType === "Company") {
        sName = (oCustomer.companyName || "New Company").trim();
      } else {
        sName = ((oCustomer.firstName || "") + " " + (oCustomer.lastName || "")).trim() || "New Customer";
      }

      // Generate Business Partner Number (e.g. 10002xxxxx)
      var sBp = "10002" + Math.floor(10000 + Math.random() * 90000);
      oCustomer.bpNumber = sBp;
      oCustomer.name = sName;

      oAppState.setProperty("/customer", oCustomer);
      oAppState.setProperty("/orderHeader/soldToParty", sBp + " - " + sName);
      oAppState.setProperty("/orderHeader/shipToParty", sBp + " - " + sName);
      oAppState.setProperty("/delivery/address", oCustomer.address);

      // Save customer to the customers model list
      var oCustomersModel = this.getModel("customers");
      if (oCustomersModel) {
        var aCustomers = oCustomersModel.getData() || [];
        aCustomers.unshift(JSON.parse(JSON.stringify(oCustomer)));
        oCustomersModel.setData(aCustomers);
      }

      // Update wizard model state
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/customerSelected", true);
      oWizardModel.setProperty("/isCreatingNewCustomer", false);
      oWizardModel.setProperty("/isNewlyCreatedCustomer", true);
      oWizardModel.setProperty("/searchPanelExpanded", false);

      // Validate Step 1 so Step 2 button is activated
      var oStepCustomer = this.byId("stepCustomer");
      if (oStepCustomer) {
        oStepCustomer.setValidated(true);
      }
      var oWizard = this.byId("salesOrderWizard");
      if (oWizard && oStepCustomer) {
        oWizard.validateStep(oStepCustomer);
      }

      MessageToast.show("New customer " + sName + " (BP " + sBp + ") created successfully!");
    },

    onChangeCustomerClick: function () {
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/searchPanelExpanded", true);
      this.onSearchCustomerClick();
    },

    // ========================================================
    // STEP 2: MARKETING INFORMATION & STEP 3 ACTIVATION
    // ========================================================
    onMarketToYouChange: function (oEvent) {
      var sKey = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getKey() : "";
      this.getModel("appState").setProperty("/marketing/marketToYou", sKey);
      var oStepConsent = this.byId("stepConsent");
      var oWizard = this.byId("salesOrderWizard");
      var bValid = !!sKey;
      if (oStepConsent) {
        oStepConsent.setValidated(bValid);
        if (oWizard) {
          if (bValid) {
            oWizard.validateStep(oStepConsent);
          } else {
            oWizard.invalidateStep(oStepConsent);
          }
        }
      }
    },

    // ========================================================
    // STEP 4: ORDER TYPE
    // ========================================================
    onOrderTypeChange: function (oEvent) {
      var sKey = oEvent.getParameter("selectedItem").getKey();
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", sKey);
      if (sKey === "ZOR") {
        oAppState.setProperty("/orderHeader/orderTypeName", "Standard Store Order");
        oAppState.setProperty("/orderHeader/orderTypeDesc", "ZOR · Take-away / collect today");
      } else if (sKey === "ZDL") {
        oAppState.setProperty("/orderHeader/orderTypeName", "Delivery Order");
        oAppState.setProperty("/orderHeader/orderTypeDesc", "ZDL · Deliver to customer");
      } else if (sKey === "ZSP") {
        oAppState.setProperty("/orderHeader/orderTypeName", "Special / Supply Order");
        oAppState.setProperty("/orderHeader/orderTypeDesc", "ZSP · Warehouse Supply");
      }
    },

    onTvLicenseTypeChange: function (oEvent) {
      var sKey = oEvent.getParameter("selectedItem").getKey();
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/tvLicenseType", sKey);
      oAppState.setProperty("/review/shippingDetails/tvLicenseType", sKey);
      MessageToast.show("TV License Type: " + sKey);
    },

    onSelectOrderTypeZOR: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", "ZOR");
      oAppState.setProperty("/orderHeader/orderTypeName", "Standard Store Order");
      oAppState.setProperty("/orderHeader/orderTypeDesc", "ZOR · Take-away / collect today");
    },

    onSelectOrderTypeZDL: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", "ZDL");
      oAppState.setProperty("/orderHeader/orderTypeName", "Delivery Order");
      oAppState.setProperty("/orderHeader/orderTypeDesc", "ZDL · Deliver to customer");
    },

    onSelectOrderTypeZSP: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", "ZSP");
      oAppState.setProperty("/orderHeader/orderTypeName", "Special / Supply Order");
      oAppState.setProperty("/orderHeader/orderTypeDesc", "ZSP · Warehouse Supply");
    },

    // ========================================================
    // STEP 5: PRODUCTS & CART
    // ========================================================
    onLiveSearchProducts: function () {
      this._applyProductFilters();
    },

    onCategoryFilterChange: function () {
      this._applyProductFilters();
    },

    _applyProductFilters: function () {
      var oWizardModel = this.getView().getModel("wizardModel");
      var sQuery = (oWizardModel.getProperty("/productSearchQuery") || "").trim();
      var sCategory = oWizardModel.getProperty("/selectedCategory");
      var aFilters = [];

      if (sQuery) {
        aFilters.push(new Filter({
          filters: [
            new Filter("name", FilterOperator.Contains, sQuery),
            new Filter("articleId", FilterOperator.Contains, sQuery)
          ],
          and: false
        }));
      }

      if (sCategory && sCategory !== "All") {
        aFilters.push(new Filter("category", FilterOperator.EQ, sCategory));
      }
    },

    onOpenAddArticleDialog: function () {
      var oView = this.getView();
      var that = this;

      this.getView().getModel("wizardModel").setProperty("/productSearchQuery", "");

      var oExistingDialog = this.byId("addArticleDialog");
      if (oExistingDialog) {
        var oTable = Fragment.byId(oView.getId(), "selectProductTable");
        if (oTable && oTable.getBinding("items")) {
          oTable.getBinding("items").filter([]);
          if (oTable.removeSelections) {
            oTable.removeSelections(true);
          }
        }
        oExistingDialog.open();
        return;
      }

      if (!this._pAddArticleDialog) {
        this._pAddArticleDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.AddArticleDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        }).catch(function (oErr) {
          that._pAddArticleDialog = null;
          console.error("Error loading AddArticleDialog:", oErr);
          MessageToast.show("Failed to open Select Product dialog: " + (oErr.message || oErr));
        });
      }

      if (this._pAddArticleDialog) {
        this._pAddArticleDialog.then(function (oDialog) {
          if (oDialog) {
            var oTable = Fragment.byId(oView.getId(), "selectProductTable");
            if (oTable && oTable.getBinding("items")) {
              oTable.getBinding("items").filter([]);
              if (oTable.removeSelections) {
                oTable.removeSelections(true);
              }
            }
            oDialog.open();
          }
        });
      }
    },

    onCloseAddArticleDialog: function () {
      var oExistingDialog = this.byId("addArticleDialog");
      if (oExistingDialog) {
        oExistingDialog.close();
      } else if (this._pAddArticleDialog) {
        this._pAddArticleDialog.then(function (oDialog) {
          if (oDialog) {
            oDialog.close();
          }
        });
      }
    },

    onLiveSearchDialogProducts: function (oEvent) {
      var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
      var aFilters = [];
      if (sQuery && sQuery.trim().length > 0) {
        sQuery = sQuery.trim();
        aFilters.push(new Filter({
          filters: [
            new Filter("name", FilterOperator.Contains, sQuery),
            new Filter("articleId", FilterOperator.Contains, sQuery),
            new Filter("category", FilterOperator.Contains, sQuery),
            new Filter("site", FilterOperator.Contains, sQuery),
            new Filter("itemCat", FilterOperator.Contains, sQuery)
          ],
          and: false
        }));
      }
      var oTable = Fragment.byId(this.getView().getId(), "selectProductTable");
      if (oTable) {
        var oBinding = oTable.getBinding("items");
        if (oBinding) oBinding.filter(aFilters);
      }
    },

    onSelectProductFromDialogRow: function (oEvent) {
      var oTable = oEvent.getSource();
      var oListItem = oEvent.getParameter("listItem");
      if (!oListItem && oTable && oTable.getSelectedItem) {
        oListItem = oTable.getSelectedItem();
      }
      if (oListItem) {
        var oProduct = oListItem.getBindingContext("products").getObject();
        this._addProductObjectToCart(oProduct);
      }
      if (oTable && oTable.removeSelections) {
        oTable.removeSelections(true);
      }
    },

    onAddProductToCartDirect: function (oEvent) {
      var oButton = oEvent.getSource();
      var oProduct = oButton.getBindingContext("products").getObject();
      this._addProductObjectToCart(oProduct);
      var oTable = Fragment.byId(this.getView().getId(), "selectProductTable");
      if (oTable && oTable.removeSelections) {
        oTable.removeSelections(true);
      }
    },

    _addProductObjectToCart: function (oProduct) {
      if (!oProduct) return;
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var nSelectedQty = 1;

      var oExisting = null;
      for (var i = 0; i < aCart.length; i++) {
        if (aCart[i].articleId === oProduct.articleId && !aCart[i].isSubItem && aCart[i].site === oProduct.site) {
          oExisting = aCart[i];
          break;
        }
      }

      if (oExisting) {
        oExisting.qty += nSelectedQty;
        oExisting.targetQty = oExisting.qty;
        oExisting.itemPrice = +(oExisting.qty * oExisting.netPrice).toFixed(2);
        oExisting.netValue = oExisting.itemPrice;
      } else {
        var nItemNo = (aCart.filter(function(it){ return !it.isSubItem; }).length + 1) * 10;
        var oNewItem = {
          item: String(nItemNo),
          articleId: oProduct.articleId,
          targetQty: nSelectedQty,
          qty: nSelectedQty,
          um: "EA",
          description: oProduct.name,
          name: oProduct.name,
          productNo: "PRD-" + oProduct.articleId,
          valueAdds: "-",
          pricePerUnit: oProduct.price,
          netPrice: oProduct.price,
          itemPrice: +(nSelectedQty * oProduct.price).toFixed(2),
          netValue: +(nSelectedQty * oProduct.price).toFixed(2),
          salesPersonId: "SP-1042",
          site: oProduct.site || "M001",
          itemCat: oProduct.itemCat || "TAN",
          extendedGuarantee: "-",
          rejReason: "-",
          discountPct: 0,
          hasCondition: false,
          conditionText: "",
          isSubItem: false,
          // Sourcing identifiers and properties
          articleStatus: oProduct.articleStatus || "M",
          sourcingIdentifier: oProduct.sourcingIdentifier || "[Status M]",
          sourcingCode: oProduct.sourcingCode || "CND_FULL",
          availableQty: (oProduct.availableQty !== undefined ? oProduct.availableQty : (oProduct.stock !== undefined ? oProduct.stock : 10)),
          stock: (oProduct.stock !== undefined ? oProduct.stock : 10),
          baseDC: oProduct.baseDC || "QL30",
          oaaSource: oProduct.oaaSource || "DC M001",
          shippingPoint: oProduct.shippingPoint || "SP-01",
          sourcingRuleDescription: oProduct.sourcingRuleDescription || ""
        };
        aCart.push(oNewItem);

        // Auto-propose value added items if any
        if (oProduct.hasEgp) {
          aCart.push({
            item: nItemNo + ".1",
            articleId: oProduct.egpArticle,
            targetQty: nSelectedQty,
            qty: nSelectedQty,
            um: "EA",
            description: oProduct.egpName,
            name: oProduct.egpName,
            subText: "value-added to item " + nItemNo,
            productNo: "SRV-0024",
            valueAdds: "Warranty",
            pricePerUnit: oProduct.egpPrice,
            netPrice: oProduct.egpPrice,
            itemPrice: +(nSelectedQty * oProduct.egpPrice).toFixed(2),
            netValue: +(nSelectedQty * oProduct.egpPrice).toFixed(2),
            salesPersonId: "SP-1042",
            site: oProduct.site || "M001",
            itemCat: "ZSRV",
            extendedGuarantee: "Yes",
            rejReason: "-",
            discountPct: 0,
            hasCondition: false,
            conditionText: "",
            isSubItem: true,
            parentItem: String(nItemNo),
            articleStatus: "NLAG",
            sourcingIdentifier: "[Warranty Plan]",
            sourcingCode: "NLAG"
          });
        }
      }

      oAppState.setProperty("/cart", aCart);
      oAppState.setProperty("/cartCount", aCart.length);
      this.recalculateTotals();
      this.updateCartSourcingEvaluation();

      var oStepProducts = this.byId("stepProducts");
      if (oStepProducts) {
        oStepProducts.setValidated(aCart.length > 0);
      }
      var oWizard = this.byId("salesOrderWizard");
      if (oWizard && oStepProducts && aCart.length > 0) {
        oWizard.validateStep(oStepProducts);
      }

      // Close dialog immediately upon selection
      this.onCloseAddArticleDialog();

      MessageToast.show("Added " + oProduct.name + " (" + oProduct.articleId + ") to Cart");
    },

    onIncreaseQty: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      var oItem = oContext.getObject();
      oItem.qty = (oItem.qty || 1) + 1;

      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      if (!oItem.isSubItem) {
        aCart.forEach(function (sub) {
          if (sub.isSubItem && sub.parentItem === oItem.item) {
            sub.qty = oItem.qty;
          }
        });
      }
      this.recalculateTotals();
      this.updateCartSourcingEvaluation();
    },

    onDecreaseQty: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      var oItem = oContext.getObject();
      if (oItem.qty > 1) {
        oItem.qty -= 1;
        var oAppState = this.getModel("appState");
        var aCart = oAppState.getProperty("/cart") || [];
        if (!oItem.isSubItem) {
          aCart.forEach(function (sub) {
            if (sub.isSubItem && sub.parentItem === oItem.item) {
              sub.qty = oItem.qty;
            }
          });
        }
        this.recalculateTotals();
        this.updateCartSourcingEvaluation();
      }
    },

    // ========================================================
    // PRICE OVERRIDE POPUP (From Item Price Link)
    // ========================================================
    onOpenPriceOverrideDialog: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("appState");
      if (!oContext) return;
      var oItem = oContext.getObject();
      this._priceOverrideItem = oItem;
      this._priceOverrideContext = oContext;

      var oPriceOverrideModel = this.getView().getModel("priceOverrideModel");
      if (!oPriceOverrideModel) {
        oPriceOverrideModel = new JSONModel({});
        this.getView().setModel(oPriceOverrideModel, "priceOverrideModel");
      }

      var currentPrice = oItem.netPrice !== undefined ? oItem.netPrice : (oItem.pricePerUnit || 0);
      oPriceOverrideModel.setData({
        itemNo: oItem.item,
        itemName: oItem.name || oItem.description,
        managerAuth: "",
        currentPrice: currentPrice,
        newPrice: (currentPrice % 1 === 0) ? String(currentPrice) : String(currentPrice)
      });

      this._openPriceOverridePopup();
    },

    _openPriceOverridePopup: function () {
      var oView = this.getView();
      var that = this;

      var oExistingDialog = this.byId("priceOverrideDialog");
      if (oExistingDialog) {
        oExistingDialog.open();
        return;
      }

      if (!this._pPriceOverrideDialog) {
        this._pPriceOverrideDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.PriceOverrideDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        }).catch(function (oErr) {
          that._pPriceOverrideDialog = null;
          console.error("Error loading PriceOverrideDialog:", oErr);
          MessageToast.show("Failed to open Price Override popup: " + (oErr.message || oErr));
        });
      }

      if (this._pPriceOverrideDialog) {
        this._pPriceOverrideDialog.then(function (oDialog) {
          if (oDialog) {
            oDialog.open();
          }
        });
      }
    },

    onCancelPriceOverride: function () {
      var oExistingDialog = this.byId("priceOverrideDialog");
      if (oExistingDialog) {
        oExistingDialog.close();
      } else if (this._pPriceOverrideDialog) {
        this._pPriceOverrideDialog.then(function (oDialog) {
          if (oDialog) {
            oDialog.close();
          }
        });
      }
    },

    onConfirmPriceOverride: function () {
      var oPriceOverrideModel = this.getView().getModel("priceOverrideModel");
      if (!oPriceOverrideModel) return;
      var sNewPrice = oPriceOverrideModel.getProperty("/newPrice");
      if (sNewPrice === undefined || sNewPrice === null || String(sNewPrice).trim() === "") {
        MessageBox.warning("Please enter a new sales price.");
        return;
      }

      var fNewPrice = parseFloat(sNewPrice);
      if (isNaN(fNewPrice) || fNewPrice < 0) {
        MessageBox.warning("Please enter a valid numeric sales price.");
        return;
      }

      var oItem = this._priceOverrideItem;
      if (!oItem && this._priceOverrideContext) {
        oItem = this._priceOverrideContext.getObject();
      }

      if (oItem) {
        var oAppState = this.getModel("appState");
        var aCart = oAppState.getProperty("/cart") || [];
        var nQty = parseInt(oItem.qty, 10) || 1;

        // Override existing line item price
        oItem.netPrice = fNewPrice;
        oItem.pricePerUnit = fNewPrice;
        oItem.itemPrice = +(nQty * fNewPrice).toFixed(2);
        oItem.netValue = oItem.itemPrice;

        oAppState.setProperty("/cart", aCart);
        this.recalculateTotals();

        MessageToast.show("Price overridden to " + fNewPrice.toFixed(2) + " for Item " + oItem.item);
      }

      this.onCancelPriceOverride();
    },

    onOpenAddCondition: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      var oItem = oContext.getObject();
      var that = this;

      MessageBox.confirm("Apply promotional discount to '" + oItem.name + "'?\n\n- Campaign Discount: 10% off", {
        title: "Add Price Condition",
        actions: ["Apply 10% Discount", MessageBox.Action.CANCEL],
        emphasizedAction: "Apply 10% Discount",
        onClose: function (sAction) {
          if (sAction === "Apply 10% Discount") {
            oItem.hasCondition = true;
            oItem.discountPct = 10;
            oItem.conditionText = "Discount -10%";
            that.recalculateTotals();
            MessageToast.show("Condition added: -10% discount applied to item " + oItem.item);
          }
        }
      });
    },

    onRemoveCartItem: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      if (!oContext) {
        return;
      }
      var oItem = oContext.getObject();
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var that = this;
      var sItemDesc = oItem.description || oItem.name || ("Item " + oItem.item);

      MessageBox.confirm("Are you sure you want to delete line item " + oItem.item + " (" + sItemDesc + ")?", {
        title: "Delete Line Item",
        actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
        emphasizedAction: MessageBox.Action.DELETE,
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.DELETE) {
            var aFiltered = aCart.filter(function (it) {
              return it.item !== oItem.item && it.parentItem !== oItem.item;
            });
            oAppState.setProperty("/cart", aFiltered);
            oAppState.setProperty("/cartCount", aFiltered.length);
            var aCurrentNotices = oAppState.getProperty("/deliveryValidationNotices") || [];
            oAppState.setProperty("/deliveryValidationNotices", aCurrentNotices.filter(function (n) {
              return n.itemKey !== oItem.item;
            }));
            that.recalculateTotals();
            that.updateCartSourcingEvaluation();
            var oStepProducts = that.byId("stepProducts");
            if (oStepProducts) {
              oStepProducts.setValidated(aFiltered.length > 0);
            }
            MessageToast.show("Line item " + oItem.item + " deleted from cart");
          }
        }
      });
    },

    onRejectionReasonChange: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      if (!oContext) {
        return;
      }
      var oItem = oContext.getObject();
      var sKey = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getKey() : "";
      var sText = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getText() : "";
      if (sKey && sKey !== "-") {
        MessageToast.show("Rejection reason set: " + sText + " for Item " + oItem.item);
      } else {
        MessageToast.show("Rejection reason cleared for Item " + oItem.item);
      }
    },

    onCartTabSelect: function (oEvent) {
      var sKey = oEvent.getParameter("key") || oEvent.getSource().getSelectedKey();
      this.getModel("appState").setProperty("/cartTab", sKey);
    },

    onAddConditionRow: function () {
      var oAppState = this.getModel("appState");
      var aConditions = oAppState.getProperty("/conditions") || [];
      aConditions.push({
        id: "cond-" + Date.now(),
        conditionType: "",
        amount: "",
        per: "1 EA",
        value: ""
      });
      oAppState.setProperty("/conditions", aConditions);
      MessageToast.show("New condition row added");
    },

    onDeleteConditionRow: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      if (!oContext) {
        return;
      }
      var sPath = oContext.getPath();
      var iIndex = parseInt(sPath.split("/").pop(), 10);
      var oAppState = this.getModel("appState");
      var aConditions = oAppState.getProperty("/conditions") || [];
      aConditions.splice(iIndex, 1);
      oAppState.setProperty("/conditions", aConditions);
      MessageToast.show("Condition row deleted");
    },

    // ========================================================
    // VALUE-ADD POPUP & ADD-ON SELECTION
    // ========================================================
    onOpenValueAddPopup: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      this._selectedParentCartItem = oContext ? oContext.getObject() : null;
      var sMainArticle = (this._selectedParentCartItem && this._selectedParentCartItem.articleId) || "HT-1000";

      // Products from user screenshot
      var aAddonProducts = [
        { mainArticle: sMainArticle, addonArticle: "AD-1001", description: "Extended Warranty - 1 Year", price: "49.99" },
        { mainArticle: sMainArticle, addonArticle: "AD-1002", description: "Protective Carry Case", price: "24.5" },
        { mainArticle: sMainArticle, addonArticle: "AD-1003", description: "Wireless Charging Station", price: "79" },
        { mainArticle: sMainArticle, addonArticle: "AD-1004", description: "Premium Support Package", price: "99.99" },
        { mainArticle: sMainArticle, addonArticle: "AD-1005", description: "Replacement Power Adapter", price: "19.95" }
      ];

      var oValueAddModel = this.getView().getModel("valueAddModel");
      if (!oValueAddModel) {
        oValueAddModel = new JSONModel({ items: aAddonProducts, allItems: aAddonProducts });
        this.getView().setModel(oValueAddModel, "valueAddModel");
      } else {
        oValueAddModel.setProperty("/items", aAddonProducts);
        oValueAddModel.setProperty("/allItems", aAddonProducts);
      }

      var oView = this.getView();
      var that = this;

      if (!this._pValueAddDialog) {
        this._pValueAddDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.ValueAddDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        });
      }

      this._pValueAddDialog.then(function (oDialog) {
        var oTable = Fragment.byId(oView.getId(), "valueAddTable");
        if (oTable) {
          oTable.removeSelections(true);
        }
        var oSearchField = Fragment.byId(oView.getId(), "valueAddSearchField");
        if (oSearchField) {
          oSearchField.setValue("");
        }
        oDialog.open();
      });
    },

    onLiveSearchValueAdd: function (oEvent) {
      var sValue = (oEvent.getParameter("newValue") || "").toLowerCase().trim();
      var oModel = this.getView().getModel("valueAddModel");
      var aAll = oModel.getProperty("/allItems") || [];
      if (!sValue) {
        oModel.setProperty("/items", aAll);
      } else {
        var aFiltered = aAll.filter(function (it) {
          return it.addonArticle.toLowerCase().indexOf(sValue) !== -1 ||
                 it.description.toLowerCase().indexOf(sValue) !== -1 ||
                 it.mainArticle.toLowerCase().indexOf(sValue) !== -1;
        });
        oModel.setProperty("/items", aFiltered);
      }
    },

    onConfirmValueAddSelection: function () {
      var oView = this.getView();
      var oTable = Fragment.byId(oView.getId(), "valueAddTable");
      var aSelected = oTable ? oTable.getSelectedItems() : [];

      if (!aSelected || aSelected.length === 0) {
        MessageToast.show("Please select at least one add-on item.");
        return;
      }

      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var oParent = this._selectedParentCartItem;
      var sParentItem = oParent ? oParent.item : "10";
      var nParentQty = (oParent && oParent.qty) ? oParent.qty : 1;

      // Find highest sub-item index for this parent
      var nSubIndex = 1;
      aCart.forEach(function (it) {
        if (it.parentItem === sParentItem && it.item.indexOf(".") !== -1) {
          var nIdx = parseInt(it.item.split(".")[1], 10);
          if (!isNaN(nIdx) && nIdx >= nSubIndex) {
            nSubIndex = nIdx + 1;
          }
        }
      });

      // Find parent index in cart
      var nParentIndex = -1;
      for (var i = 0; i < aCart.length; i++) {
        if (aCart[i].item === sParentItem) {
          nParentIndex = i;
          break;
        }
      }

      var aNewItems = [];
      for (var j = 0; j < aSelected.length; j++) {
        var oAddon = aSelected[j].getBindingContext("valueAddModel").getObject();
        var sItemNum = sParentItem + "." + (nSubIndex++);
        var fPrice = parseFloat(oAddon.price) || 0;
        var fTotal = +(fPrice * nParentQty).toFixed(2);

        var oNewItem = {
          item: sItemNum,
          articleId: oAddon.addonArticle,
          targetQty: nParentQty,
          qty: nParentQty,
          um: "EA",
          description: oAddon.description,
          name: oAddon.description,
          productNo: "PRD-" + oAddon.addonArticle,
          valueAdds: "-",
          pricePerUnit: fPrice,
          netPrice: fPrice,
          itemPrice: fTotal,
          netValue: fTotal,
          salesPersonId: (oParent && oParent.salesPersonId) || "SP-1042",
          site: (oParent && oParent.site) || "S101",
          itemCat: "ZSRV",
          extendedGuarantee: oAddon.addonArticle.indexOf("1001") !== -1 ? oAddon.addonArticle : "-",
          rejReason: "-",
          discountPct: 0,
          hasCondition: false,
          conditionText: "",
          isSubItem: true,
          isValueAdd: true,
          parentItem: sParentItem
        };
        aNewItems.push(oNewItem);
      }

      // Insert directly after parent/existing sub-items
      if (nParentIndex !== -1) {
        var nInsertAt = nParentIndex + 1;
        while (nInsertAt < aCart.length && aCart[nInsertAt].parentItem === sParentItem) {
          nInsertAt++;
        }
        for (var k = 0; k < aNewItems.length; k++) {
          aCart.splice(nInsertAt + k, 0, aNewItems[k]);
        }
      } else {
        aNewItems.forEach(function (it) { aCart.push(it); });
      }

      oAppState.setProperty("/cart", aCart);
      this.recalculateTotals();

      if (this._pValueAddDialog) {
        this._pValueAddDialog.then(function (oDialog) {
          oDialog.close();
        });
      }

      MessageToast.show(aNewItems.length + " add-on item(s) added to cart");
    },

    onCloseValueAddDialog: function () {
      if (this._pValueAddDialog) {
        this._pValueAddDialog.then(function (oDialog) {
          oDialog.close();
        });
      }
    },

    // ========================================================
    // STEP 5: DELIVERY METHOD & SOURCING STRATEGY (SRS V3.3)
    // ========================================================
    onSelectDeliveryCND: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/deliveryValidationPassed", false);
      oAppState.setProperty("/delivery/methodKey", "CND");
      oAppState.setProperty("/delivery/methodTitle", "Delivery (CND)");
      oAppState.setProperty("/delivery/methodSubtitle", "Deliver to customer address");
      oAppState.setProperty("/delivery/deliveryType", "Delivery");
      oAppState.setProperty("/review/shippingDetails/deliveryMethod", "Delivery (CND)");
      this.updateCartSourcingEvaluation();
      MessageToast.show("Delivery Method: Delivery (CND)");
    },

    onOpenDeliveryAddressValidation: function () {
      var that = this;
      var oAppState = this.getModel("appState");

      this.openAddressValidationDialog("Delivery Address", function (oSelectedAddress) {
        if (oSelectedAddress) {
          var sFormatted = oSelectedAddress.formatted || (oSelectedAddress.street + ", " + oSelectedAddress.city + ", " + (oSelectedAddress.region || "") + " " + (oSelectedAddress.postalCode || ""));
          
          var oAddrObj = {
            street: oSelectedAddress.street || "",
            city: oSelectedAddress.city || "",
            postalCode: oSelectedAddress.postalCode || "",
            region: oSelectedAddress.region || "",
            country: oSelectedAddress.country || "South Africa",
            formatted: sFormatted,
            status: oSelectedAddress.status || "VALIDATED",
            statusState: that.formatter && that.formatter.addressStatusState ? that.formatter.addressStatusState(oSelectedAddress.status || "VALIDATED") : "Success",
            validated: true
          };

          oAppState.setProperty("/delivery/deliveryAddress", oAddrObj);
          
          // Also sync to shipToAddress for downstream review steps
          oAppState.setProperty("/delivery/shipToAddress/street", oSelectedAddress.street || "");
          oAppState.setProperty("/delivery/shipToAddress/city", oSelectedAddress.city || "");
          oAppState.setProperty("/delivery/shipToAddress/postalCode", oSelectedAddress.postalCode || "");
          oAppState.setProperty("/delivery/shipToAddress/state", oSelectedAddress.region || "");
          oAppState.setProperty("/delivery/shipToAddress/formatted", sFormatted);
          oAppState.setProperty("/review/shippingDetails/address", sFormatted);

          that.updateCartSourcingEvaluation();
          MessageToast.show("Delivery Address validated: " + sFormatted);
        }
      });
    },

    onSelectClickAndCollectCNC: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/deliveryValidationPassed", false);
      oAppState.setProperty("/delivery/methodKey", "CNC");
      oAppState.setProperty("/delivery/methodTitle", "Click & Collect (CNC)");
      oAppState.setProperty("/delivery/methodSubtitle", "Collect from store");
      oAppState.setProperty("/delivery/deliveryType", "Pick");
      oAppState.setProperty("/review/shippingDetails/deliveryMethod", "Click & Collect (CNC)");
      var oStore = oAppState.getProperty("/delivery/collectionStore");
      if (oStore && oStore.storeName) {
        oAppState.setProperty("/review/shippingDetails/shipTo", oStore.storeName);
        oAppState.setProperty("/review/shippingDetails/address", oStore.address);
      }
      this.updateCartSourcingEvaluation();
      MessageToast.show("Delivery Method: Click & Collect (CNC)");
    },

    onSelectBopisCNP: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/deliveryValidationPassed", false);
      oAppState.setProperty("/delivery/methodKey", "CNP");
      oAppState.setProperty("/delivery/methodTitle", "BOPIS (CNP)");
      oAppState.setProperty("/delivery/methodSubtitle", "Collect from pickup point");
      oAppState.setProperty("/delivery/deliveryType", "Warehouse");
      oAppState.setProperty("/review/shippingDetails/deliveryMethod", "BOPIS (CNP)");
      var oPoint = oAppState.getProperty("/delivery/pickupPoint");
      if (oPoint && oPoint.pointName) {
        oAppState.setProperty("/review/shippingDetails/shipTo", oPoint.pointName);
        oAppState.setProperty("/review/shippingDetails/address", oPoint.location);
      }
      this.updateCartSourcingEvaluation();
      MessageToast.show("Delivery Method: BOPIS (CNP)");
    },

    onCollectionStoreChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (!oItem) {
        return;
      }
      var sKey = oItem.getKey();
      var oAppState = this.getModel("appState");
      var aStores = oAppState.getProperty("/delivery/collectionStores") || [];
      var oStore = aStores.find(function (s) {
        return s.storeId === sKey;
      });
      if (oStore) {
        oAppState.setProperty("/delivery/collectionStore", Object.assign({}, oStore));
        oAppState.setProperty("/review/shippingDetails/shipTo", oStore.storeName);
        oAppState.setProperty("/review/shippingDetails/address", oStore.address);
        this.updateCartSourcingEvaluation();
        MessageToast.show("Store selected: " + oStore.storeName);
      }
    },

    onPickupPointChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (!oItem) {
        return;
      }
      var sKey = oItem.getKey();
      var oAppState = this.getModel("appState");
      var aPoints = oAppState.getProperty("/delivery/pickupPoints") || [];
      var oPoint = aPoints.find(function (p) {
        return p.pointId === sKey;
      });
      if (oPoint) {
        oAppState.setProperty("/delivery/pickupPoint", Object.assign({}, oPoint));
        oAppState.setProperty("/review/shippingDetails/shipTo", oPoint.pointName);
        oAppState.setProperty("/review/shippingDetails/address", oPoint.location);
        this.updateCartSourcingEvaluation();
        MessageToast.show("Pickup point selected: " + oPoint.pointName);
      }
    },

    onDeliveryMethodStepActivate: function () {
      var oAppState = this.getModel("appState");
      if (oAppState) {
        oAppState.setProperty("/deliveryValidationPassed", false);
        oAppState.setProperty("/deliveryValidationNotice", "");
        oAppState.setProperty("/deliveryValidationNotices", []);
      }
      this.updateCartSourcingEvaluation();
    },

    onRefreshSourcing: function () {
      this.updateCartSourcingEvaluation();
      MessageToast.show("Sourcing logic re-evaluated for current cart items");
    },

    /**
     * Sourcing Logic Engine based on SRS V3.3 Decision Table:
     * Evaluates all cart items against the currently selected delivery method (CND, CNC, CNP)
     */
    updateCartSourcingEvaluation: function () {
      var oAppState = this.getModel("appState");
      if (!oAppState) return;

      var sMethod = oAppState.getProperty("/delivery/methodKey") || "CND";
      var aCart = oAppState.getProperty("/cart") || [];
      var oStore = oAppState.getProperty("/delivery/collectionStore") || { storeName: "Centurion Lifestyle Centre" };
      var oPoint = oAppState.getProperty("/delivery/pickupPoint") || { pointName: "Centurion Mall Locker Hub" };
      var sAddress = oAppState.getProperty("/delivery/deliveryAddress/formatted") || "12 Rivonia Road, Sandton, 2196";

      var nBlockingCount = 0;
      var nActionableCount = 0;

      aCart.forEach(function (item) {
        if (item.isSubItem) {
          item.sourcingStatusText = "Attached Service";
          item.sourcingState = "None";
          item.sourcingActionText = "Linked to parent line item " + (item.parentItem || "");
          item.routingTarget = "Fulfilled with parent item";
          item.isBlocking = false;
          item.mustRemove = false;
          item.canReduce = false;
          item.isSplit = false;
          item.isAssignedBaseDC = false;
          item.isReserved = false;
          item.sourcingTooltip = "Attached Service";
          return;
        }

        // Rule Note 1: Exclude NLAG items from OAA request
        if (item.itemCat === "NLAG" || item.articleStatus === "NLAG" || item.sourcingCode === "NLAG") {
          item.sourcingStatusText = "Excluded from OAA";
          item.sourcingState = "None";
          item.sourcingActionText = "Applies to all sourcing calls: Exclude NLAG items from OAA request. Directly confirmed non-stock service.";
          item.routingTarget = "Direct Fulfillment / Non-stock";
          item.isBlocking = false;
          item.mustRemove = false;
          item.canReduce = false;
          item.isSplit = false;
          item.isAssignedBaseDC = false;
          item.isReserved = false;
          item.sourcingTooltip = "NLAG · Non-stock";
          return;
        }

        var sStatus = item.articleStatus || "M";
        var nAvail = (item.availableQty !== undefined) ? item.availableQty : (item.stock !== undefined ? item.stock : 10);
        var nReq = item.qty || 1;

        if (sMethod === "CND") {
          // ==========================================
          // CLICK & DELIVER (CND)
          // ==========================================
          if (nAvail === 0 || item.sourcingCode === "CND_F001_M" || item.sourcingCode === "CND_F001_NOT_M") {
            if (sStatus === "M") {
              // Row 2: F001 · No stock | M
              item.sourcingStatusText = "F001 · No Stock (M)";
              item.sourcingState = "Warning";
              item.sourcingActionText = "Do not reserve the unavailable line. Assign it to customer's Base DC (" + (item.baseDC || "QL30") + ") and allow the order to proceed.";
              item.routingTarget = "Customer Base DC (" + (item.baseDC || "QL30") + ")";
              item.sourcingTooltip = "F001 (M) · Stock not available";
              item.isBlocking = false;
              item.mustRemove = false;
              item.canReduce = false;
              item.isSplit = false;
              item.isAssignedBaseDC = true;
              item.isReserved = false;
              nActionableCount++;
            } else {
              // Row 3: F001 · No stock | Not M
              item.sourcingStatusText = "F001 · No Stock (Not M)";
              item.sourcingState = "Error";
              item.sourcingActionText = "Show the affected item. Require the user to remove it, then run sourcing again. (Order blocked until removed)";
              item.routingTarget = "Blocked (Unavailable)";
              item.sourcingTooltip = "F001 (Not M) · Stock not available";
              item.isBlocking = true;
              item.mustRemove = true;
              item.canReduce = false;
              item.isSplit = false;
              item.isAssignedBaseDC = false;
              item.isReserved = false;
              nBlockingCount++;
            }
          } else if (nAvail < nReq || item.sourcingCode === "CND_F002_M" || item.sourcingCode === "CND_F002_NOT_M") {
            if (sStatus === "M") {
              // Row 4: F002 · Partial stock | M
              var nAvailToReserve = Math.min(nAvail, nReq);
              var nRemainder = nReq - nAvailToReserve;
              item.sourcingStatusText = "F002 · Partial Stock (M)";
              item.sourcingState = "Information";
              item.sourcingActionText = "Reserve available quantity (" + nAvailToReserve + " EA) and route remainder (" + nRemainder + " EA) to Base DC (" + (item.baseDC || "QL30") + ") as additional line. Allow order to proceed.";
              item.routingTarget = nAvailToReserve + " EA @ OAA | " + nRemainder + " EA @ Base DC (" + (item.baseDC || "QL30") + ")";
              item.sourcingTooltip = "F002 (M) · Partially available";
              item.isBlocking = false;
              item.mustRemove = false;
              item.canReduce = false;
              item.isSplit = (nRemainder > 0);
              item.splitAvailQty = nAvailToReserve;
              item.splitRemainderQty = nRemainder;
              nActionableCount++;
            } else {
              // Row 5: F002 · Partial stock | Not M
              item.sourcingStatusText = "F002 · Partial Stock (Not M)";
              item.sourcingState = "Error";
              item.sourcingActionText = "V3.3 Corrected Rule: Remove the line item from the cart, then run sourcing again.";
              item.routingTarget = "Blocked (Remove Item)";
              item.sourcingTooltip = "F002 (Not M) · Partially available";
              item.isBlocking = true;
              item.mustRemove = true;
              item.canReduce = false;
              item.isSplit = false;
              nBlockingCount++;
            }
          } else {
            // Row 1: Full stock available | Any
            item.sourcingStatusText = "Full Stock Available";
            item.sourcingState = "Success";
            item.sourcingActionText = "Reserve requested quantity (" + nReq + " EA) at OAA source. OAA determines supplying site (" + (item.site || "M001") + ") and shipping point (" + (item.shippingPoint || "SP-01") + ") automatically.";
            item.routingTarget = "OAA Source (" + (item.site || "M001") + ") · " + (item.shippingPoint || "SP-01");
            item.sourcingTooltip = "CND · Stock available";
            item.isBlocking = false;
            item.mustRemove = false;
            item.canReduce = false;
            item.isSplit = false;
            item.isReserved = true;
            item.isAssignedBaseDC = false;
          }
        } else if (sMethod === "CNC") {
          // ==========================================
          // STORE COLLECTION (CNC)
          // ==========================================
          if (nAvail === 0 || item.sourcingCode === "NO_LOCATION" || item.sourcingCode === "CND_F001_NOT_M" || item.sourcingCode === "CND_F001_M") {
            if (sStatus === "M" || item.articleStatus === "M") {
              // F001 · No stock | M -> Allow user to proceed via Base DC
              item.sourcingStatusText = "F001 · Assigned to Base DC (M)";
              item.sourcingState = "Information";
              item.sourcingActionText = "Do not reserve the unavailable line. Assign it to customer's Base DC (" + (item.baseDC || "QL30") + ") and allow the order to proceed.";
              item.routingTarget = "Customer Base DC (" + (item.baseDC || "QL30") + ")";
              item.sourcingTooltip = "F001 (M) · Base DC assignment · Proceed allowed";
              item.isBlocking = false;
              item.mustRemove = false;
              item.canReduce = false;
              item.isSplit = false;
              item.isAssignedBaseDC = true;
              item.isReserved = false;
              nActionableCount++;
            } else {
              // Row 10: Store Collection | No stock / No eligible store location
              item.sourcingStatusText = "No Stock at Store";
              item.sourcingState = "Error";
              item.sourcingActionText = "Item has 0 stock at store location. Remove line item from cart.";
              item.routingTarget = "No Store Eligible (0 Stock)";
              item.sourcingTooltip = "CNC · F001 · Stock not available";
              item.isBlocking = true;
              item.mustRemove = true;
              item.canReduce = false;
              item.isSplit = false;
              nBlockingCount++;
            }
          } else if (nAvail < nReq || item.sourcingCode === "CNC_PARTIAL" || item.sourcingCode === "CND_F002_M" || item.sourcingCode === "CND_F002_NOT_M") {
            // Row 7: Store Collection CNC | F002 · Partial stock | Any
            var nAvailStore = Math.min(nAvail, nReq);
            item.sourcingStatusText = "F002 · Partial Stock (Store)";
            item.sourcingState = "Warning";
            item.sourcingActionText = "Show eligible stores ranked by available stock. Ask user to reduce quantity to available amount (" + nAvailStore + " EA); reserve that quantity.";
            item.routingTarget = (oStore.storeName || "Store S101") + " (" + nAvailStore + " EA on hand)";
            item.sourcingTooltip = "CNC · F002 · Partially available";
            item.canReduce = (nReq > nAvailStore && nAvailStore > 0);
            item.recommendedQty = nAvailStore;
            item.isBlocking = (nReq > nAvailStore);
            item.mustRemove = (nAvailStore === 0);
            item.isSplit = false;
            if (item.isBlocking) nBlockingCount++;
            nActionableCount++;
          } else {
            // Row 6: Store Collection CNC | Full stock available | Eligible articles
            item.sourcingStatusText = "Full Stock at Store";
            item.sourcingState = "Success";
            item.sourcingActionText = "Show stores with full quantity available. Stock (" + nReq + " EA) will be reserved at " + (oStore.storeName || "Store S101") + ".";
            item.routingTarget = (oStore.storeName || "Store S101") + " · Reserved";
            item.sourcingTooltip = "CNC · Stock available";
            item.isBlocking = false;
            item.mustRemove = false;
            item.canReduce = false;
            item.isSplit = false;
            item.isReserved = true;
            item.isAssignedBaseDC = false;
          }
        } else if (sMethod === "CNP") {
          // ==========================================
          // BOPIS POINT (CNP)
          // ==========================================
          if (nAvail === 0 || item.sourcingCode === "NO_LOCATION" || item.sourcingCode === "CND_F001_NOT_M" || item.sourcingCode === "CND_F001_M") {
            if (sStatus === "M" || item.articleStatus === "M") {
              // F001 · No stock | M -> Allow user to proceed via Base DC
              item.sourcingStatusText = "F001 · Assigned to Base DC (M)";
              item.sourcingState = "Information";
              item.sourcingActionText = "Do not reserve the unavailable line. Assign it to customer's Base DC (" + (item.baseDC || "QL30") + ") and allow the order to proceed.";
              item.routingTarget = "Customer Base DC (" + (item.baseDC || "QL30") + ")";
              item.sourcingTooltip = "F001 (M) · Base DC assignment · Proceed allowed";
              item.isBlocking = false;
              item.mustRemove = false;
              item.canReduce = false;
              item.isSplit = false;
              item.isAssignedBaseDC = true;
              item.isReserved = false;
              nActionableCount++;
            } else {
              // Row 10: BOPIS | No stock / No eligible pickup hub
              item.sourcingStatusText = "No Stock at BOPIS Hub";
              item.sourcingState = "Error";
              item.sourcingActionText = "Item has 0 stock at pickup point hub. Remove line item from cart.";
              item.routingTarget = "No Point Eligible (0 Stock)";
              item.sourcingTooltip = "CNP · F001 · Stock not available";
              item.isBlocking = true;
              item.mustRemove = true;
              item.canReduce = false;
              item.isSplit = false;
              nBlockingCount++;
            }
          } else if (nAvail < nReq || item.sourcingCode === "CNP_PARTIAL" || item.sourcingCode === "CNC_PARTIAL" || item.sourcingCode === "CND_F002_M" || item.sourcingCode === "CND_F002_NOT_M") {
            // Row 9: BOPIS Point CNP | F002 · Partial stock | Any
            var nAvailHub = Math.min(nAvail, nReq);
            item.sourcingStatusText = "F002 · Partial Stock (BOPIS)";
            item.sourcingState = "Warning";
            item.sourcingActionText = "Show pickup points ranked by available quantity. Ask user to reduce quantity (to " + nAvailHub + " EA); reserve available amount.";
            item.routingTarget = (oPoint.pointName || "BOPIS Hub") + " (" + nAvailHub + " EA available)";
            item.sourcingTooltip = "CNP · F002 · Partially available";
            item.canReduce = (nReq > nAvailHub && nAvailHub > 0);
            item.recommendedQty = nAvailHub;
            item.isBlocking = (nReq > nAvailHub);
            item.mustRemove = (nAvailHub === 0);
            item.isSplit = false;
            if (item.isBlocking) nBlockingCount++;
            nActionableCount++;
          } else {
            // Row 8: BOPIS Point CNP | Full stock available | Eligible articles
            item.sourcingStatusText = "Full Stock at Hub";
            item.sourcingState = "Success";
            item.sourcingActionText = "Show pickup points with stock available. Stock (" + nReq + " EA) will be reserved at " + (oPoint.pointName || "BOPIS Hub") + ".";
            item.routingTarget = (oPoint.pointName || "BOPIS Hub") + " · Reserved";
            item.sourcingTooltip = "CNP · Stock available";
            item.isBlocking = false;
            item.mustRemove = false;
            item.canReduce = false;
            item.isSplit = false;
            item.isReserved = true;
            item.isAssignedBaseDC = false;
          }
        }
      });

      var oSourcingSummary = {
        methodKey: sMethod,
        totalItems: aCart.filter(function (it) { return !it.isSubItem; }).length,
        blockingCount: nBlockingCount,
        actionableCount: nActionableCount,
        hasErrors: nBlockingCount > 0,
        statusState: nBlockingCount > 0 ? "Error" : (nActionableCount > 0 ? "Warning" : "Success"),
        statusTitle: nBlockingCount > 0
          ? "Sourcing Action Required: " + nBlockingCount + " item(s) cannot proceed per SRS V3.3 rules"
          : (nActionableCount > 0
              ? "Sourcing Verified: Rule assignments applied per SRS V3.3 decision table"
              : "All items sourced successfully. Reservable stock determined."),
        statusDescription: nBlockingCount > 0
          ? "Affected lines must be removed or reduced to available quantities before continuing to Review Shipping."
          : (sMethod === "CND"
              ? "OAA geolocated address (" + sAddress + "). Supplying sites and Base DC (QL30) assignments verified."
              : (sMethod === "CNC"
                  ? "Items verified against " + (oStore.storeName || "Centurion Centre") + ". Cart reservations created."
                  : "Items verified against " + (oPoint.pointName || "Centurion Hub") + ". Cart reservations created."))
      };

      oAppState.setProperty("/sourcingSummary", oSourcingSummary);
      oAppState.setProperty("/cart", aCart);

      var bPassed = oAppState.getProperty("/deliveryValidationPassed") === true;
      if (nBlockingCount > 0) {
        bPassed = false;
        oAppState.setProperty("/deliveryValidationPassed", false);
      } else if (nBlockingCount === 0 && aCart.length > 0) {
        oAppState.setProperty("/deliveryValidationNotice", "");
        oAppState.setProperty("/deliveryValidationNotices", []);
      }

      var oStep5 = this.byId("stepDeliveryMethod");
      var oWizard = this.byId("salesOrderWizard");
      var bStep5Valid = (aCart.length > 0) && (nBlockingCount === 0) && bPassed;
      if (oStep5) {
        oStep5.setValidated(bStep5Valid);
        if (oWizard) {
          if (bStep5Valid) {
            oWizard.validateStep(oStep5);
          } else {
            oWizard.invalidateStep(oStep5);
          }
        }
      }
    },

    onRemoveSourcingItem: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("appState");
      if (!oContext) return;
      var oItem = oContext.getObject();
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var aFiltered = aCart.filter(function (it) {
        return it.item !== oItem.item && it.parentItem !== oItem.item;
      });
      oAppState.setProperty("/cart", aFiltered);
      oAppState.setProperty("/cartCount", aFiltered.length);
      var aCurrentNotices = oAppState.getProperty("/deliveryValidationNotices") || [];
      oAppState.setProperty("/deliveryValidationNotices", aCurrentNotices.filter(function (n) {
        return n.itemKey !== oItem.item;
      }));
      this.recalculateTotals();
      this.updateCartSourcingEvaluation();
      MessageToast.show("Removed " + (oItem.name || oItem.item) + ". Sourcing re-run successfully.");
    },

    onReduceQtyToAvailable: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("appState");
      if (!oContext) return;
      var oItem = oContext.getObject();
      var nNewQty = oItem.recommendedQty || oItem.availableQty || 1;
      oItem.qty = nNewQty;
      oItem.targetQty = nNewQty;
      var oAppState = this.getModel("appState");
      var aCurrentNotices = oAppState.getProperty("/deliveryValidationNotices") || [];
      oAppState.setProperty("/deliveryValidationNotices", aCurrentNotices.filter(function (n) {
        return n.itemKey !== oItem.item;
      }));
      this.recalculateTotals();
      this.updateCartSourcingEvaluation();
      MessageToast.show("Reduced quantity for " + (oItem.name || oItem.item) + " to available amount (" + nNewQty + " EA). Stock reserved.");
    },

    onSplitLineToBaseDC: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("appState");
      if (!oContext) return;
      var oItem = oContext.getObject();
      var nAvail = oItem.splitAvailQty || oItem.availableQty || 1;
      var nRemainder = oItem.splitRemainderQty || (oItem.qty - nAvail);
      if (nRemainder <= 0) return;

      oItem.qty = nAvail;
      oItem.targetQty = nAvail;
      oItem.isSplit = false;
      oItem.isReserved = true;

      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var nIdx = aCart.indexOf(oItem);

      var oRemainderLine = {
        item: oItem.item + "B",
        articleId: oItem.articleId,
        targetQty: nRemainder,
        qty: nRemainder,
        um: oItem.um || "EA",
        description: oItem.name + " [Base DC Remainder]",
        name: oItem.name + " [Base DC Remainder]",
        productNo: (oItem.productNo || "") + "-REM",
        valueAdds: "-",
        pricePerUnit: oItem.pricePerUnit || oItem.netPrice,
        netPrice: oItem.netPrice,
        itemPrice: +(nRemainder * oItem.netPrice).toFixed(2),
        netValue: +(nRemainder * oItem.netPrice).toFixed(2),
        salesPersonId: oItem.salesPersonId || "SP-1042",
        site: oItem.site || "M001",
        itemCat: oItem.itemCat || "TAN",
        extendedGuarantee: "-",
        rejReason: "-",
        discountPct: 0,
        hasCondition: false,
        conditionText: "",
        isSubItem: false,
        articleStatus: "M",
        sourcingIdentifier: "[M · Base DC Remainder]",
        sourcingCode: "CND_F001_M",
        availableQty: 0,
        stock: 0,
        baseDC: oItem.baseDC || "QL30",
        oaaSource: "Customer Base DC (" + (oItem.baseDC || "QL30") + ")",
        shippingPoint: "SP-QL30",
        sourcingStatusText: "Routed to Base DC (QL30)",
        sourcingState: "Warning",
        sourcingActionText: "Backorder remainder routed to Base DC QL30 as additional line per SRS V3.3 rule.",
        routingTarget: "Base DC (" + (oItem.baseDC || "QL30") + ")",
        isAssignedBaseDC: true,
        isSplit: false,
        isBlocking: false,
        mustRemove: false,
        canReduce: false,
        isReserved: false
      };

      if (nIdx >= 0) {
        aCart.splice(nIdx + 1, 0, oRemainderLine);
      } else {
        aCart.push(oRemainderLine);
      }

      oAppState.setProperty("/cart", aCart);
      oAppState.setProperty("/cartCount", aCart.length);
      this.recalculateTotals();
      this.updateCartSourcingEvaluation();
      MessageToast.show("Line split applied: " + nAvail + " EA reserved @ OAA source; " + nRemainder + " EA routed to Base DC QL30.");
    },

    onAutoResolveSourcingIssues: function () {
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var aResolvedCart = [];

      aCart.forEach(function (item) {
        if (item.mustRemove) {
          // Rule: Remove affected item from cart
          return;
        }
        if (item.canReduce) {
          // Rule: Reduce quantity to available amount
          item.qty = item.recommendedQty || item.availableQty || 1;
          item.targetQty = item.qty;
          aResolvedCart.push(item);
          return;
        }
        if (item.isSplit && item.splitRemainderQty > 0) {
          // Rule: Split line into reservable OAA and Base DC remainder line
          var nAvail = item.splitAvailQty || item.availableQty || 1;
          var nRem = item.splitRemainderQty;
          item.qty = nAvail;
          item.targetQty = nAvail;
          item.isSplit = false;
          item.isReserved = true;
          aResolvedCart.push(item);

          var oRemainder = Object.assign({}, item, {
            item: item.item + "B",
            name: item.name + " [Base DC Remainder]",
            description: item.description + " [Base DC Remainder]",
            qty: nRem,
            targetQty: nRem,
            availableQty: 0,
            stock: 0,
            sourcingIdentifier: "[M · Base DC Remainder]",
            sourcingCode: "CND_F001_M",
            sourcingStatusText: "Routed to Base DC (QL30)",
            sourcingState: "Warning",
            sourcingActionText: "Backorder remainder routed to Base DC QL30 per SRS V3.3 rule.",
            routingTarget: "Base DC (" + (item.baseDC || "QL30") + ")",
            isAssignedBaseDC: true,
            isSplit: false,
            isBlocking: false,
            mustRemove: false,
            canReduce: false,
            isReserved: false
          });
          aResolvedCart.push(oRemainder);
          return;
        }
        aResolvedCart.push(item);
      });

      oAppState.setProperty("/cart", aResolvedCart);
      oAppState.setProperty("/cartCount", aResolvedCart.length);
      this.recalculateTotals();
      this.updateCartSourcingEvaluation();
      oAppState.setProperty("/deliveryValidationPassed", true);
      oAppState.setProperty("/deliveryValidationNotice", "");
      var oStep5Resolved = this.byId("stepDeliveryMethod");
      var oWizardResolved = this.byId("salesOrderWizard");
      if (oStep5Resolved) {
        oStep5Resolved.setValidated(true);
        if (oWizardResolved) {
          oWizardResolved.validateStep(oStep5Resolved);
        }
      }
    },

    onDeliveryContinuePress: function () {
      this.updateCartSourcingEvaluation();
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];

      if (!aCart || aCart.length === 0) {
        // Display separate short MessageStrip for empty cart; no MessageBox popup!
        oAppState.setProperty("/deliveryValidationNotices", [
          {
            id: "empty_cart",
            itemKey: "empty",
            type: "Warning",
            text: "Cart is empty. Please add products."
          }
        ]);
        oAppState.setProperty("/deliveryValidationNotice", "");
        oAppState.setProperty("/deliveryValidationPassed", false);
        var oStep5Empty = this.byId("stepDeliveryMethod");
        var oWizardEmpty = this.byId("salesOrderWizard");
        if (oStep5Empty) {
          oStep5Empty.setValidated(false);
          if (oWizardEmpty) {
            oWizardEmpty.invalidateStep(oStep5Empty);
          }
        }
        return;
      }

      var aNotices = [];

      aCart.forEach(function (item) {
        var sItemName = item.description || item.name || ("Item " + item.item);
        var sStatus = item.articleStatus || item.stockState || "M";
        var isStatusM = (sStatus === "M" || item.articleStatus === "M");
        var nAvail = (item.availableQty !== undefined) ? item.availableQty : (item.stock !== undefined ? item.stock : 10);
        var isF001 = (nAvail === 0 || item.sourcingCode === "CND_F001_M" || item.sourcingCode === "CND_F001_NOT_M" || (item.sourcingStatusText && item.sourcingStatusText.indexOf("F001") !== -1));

        // Rule: for sourcing F001 and status M - allow user to proceed and dont show validation message
        if (isF001 && isStatusM) {
          item.mustRemove = false;
          item.isBlocking = false;
          return;
        }

        // Check if item must be removed (no stock available / blocked per SRS rules)
        if (item.mustRemove || item.sourcingState === "Error" || (nAvail === 0 && !isStatusM)) {
          aNotices.push({
            id: "remove_" + item.item,
            itemKey: item.item,
            type: "Error",
            text: sItemName + ": No stock. Please remove item."
          });
        } else if (item.canReduce || (nAvail !== undefined && item.qty > nAvail && !isStatusM)) {
          // Check if item quantity needs to be changed / reduced to available stock
          var nAvailRec = item.recommendedQty || nAvail || 0;
          aNotices.push({
            id: "qty_" + item.item,
            itemKey: item.item,
            type: "Warning",
            text: sItemName + ": Only " + nAvailRec + " EA available. Change quantity to " + nAvailRec + " EA."
          });
        }
      });

      var oSourcingSummary = oAppState.getProperty("/sourcingSummary") || {};
      var bHasStockIssues = (aNotices.length > 0) || (oSourcingSummary.blockingCount > 0);

      if (bHasStockIssues) {
        oAppState.setProperty("/deliveryValidationPassed", false);
        // Display separate short MessageStrip for each product with a negative case!
        oAppState.setProperty("/deliveryValidationNotices", aNotices);
        oAppState.setProperty("/deliveryValidationNotice", "");

        var oStep5Err = this.byId("stepDeliveryMethod");
        var oWizardErr = this.byId("salesOrderWizard");
        if (oStep5Err) {
          oStep5Err.setValidated(false);
          if (oWizardErr) {
            oWizardErr.invalidateStep(oStep5Err);
          }
        }
      } else {
        // Status is fine (all items have stock / valid routing or F001 with status M)
        oAppState.setProperty("/deliveryValidationPassed", true);
        // Do not display any message for full stock, stock available, or sufficient stock / F001 status M!
        oAppState.setProperty("/deliveryValidationNotices", []);
        oAppState.setProperty("/deliveryValidationNotice", "");

        var oStep5Ok = this.byId("stepDeliveryMethod");
        var oWizardOk = this.byId("salesOrderWizard");
        if (oStep5Ok) {
          oStep5Ok.setValidated(true);
          if (oWizardOk) {
            oWizardOk.validateStep(oStep5Ok);
          }
        }

        MessageToast.show("Stock validated. Click 'Step 6: Review Shipping' to proceed.");
      }
    },

    onDismissSingleDeliveryNotice: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("appState");
      if (!oContext) return;
      var oNotice = oContext.getObject();
      var oAppState = this.getModel("appState");
      var aNotices = oAppState.getProperty("/deliveryValidationNotices") || [];
      var aUpdated = aNotices.filter(function (n) {
        return n !== oNotice && n.id !== oNotice.id;
      });
      oAppState.setProperty("/deliveryValidationNotices", aUpdated);
    },

    onCloseDeliveryValidationNotice: function () {
      var oAppState = this.getModel("appState");
      if (oAppState) {
        oAppState.setProperty("/deliveryValidationNotice", "");
        oAppState.setProperty("/deliveryValidationNotices", []);
      }
    },

    onProceedToStep6: function () {
      var oWizard = this.byId("salesOrderWizard");
      var oStepDelivery = this.byId("stepDelivery");
      if (oWizard && oStepDelivery) {
        oStepDelivery.setValidated(true);
        oWizard.goToStep(oStepDelivery, true);
      }
    },

    onOpenSourcingReferenceDialog: function () {
      var oView = this.getView();
      if (!this._pSourcingDialog) {
        this._pSourcingDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.SourcingDecisionTableDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        });
      }
      this._pSourcingDialog.then(function (oDialog) {
        oDialog.open();
      });
    },

    onCloseSourcingReferenceDialog: function () {
      if (this._pSourcingDialog) {
        this._pSourcingDialog.then(function (oDialog) {
          oDialog.close();
        });
      }
    },

    onLoadAllSourcingDemoCases: function () {
      var oAppState = this.getModel("appState");
      var oWizardModel = this.getView().getModel("wizardModel");

      // 1. Setup valid customer
      var oCustomer = {
        bpNumber: "1000234571",
        name: "Thabo Mokoena",
        firstName: "Thabo",
        lastName: "Mokoena",
        title: "Mr.",
        telephone: "+27 82 555 0192",
        email: "thabo.mokoena@email.co.za",
        type: "Individual",
        dateOfBirth: "1988-05-14",
        gender: "Male",
        idType: "SA ID Number",
        idPassport: "8805145028084",
        language: "English",
        salesOrg: "1000",
        distChannel: "10",
        division: "00",
        address: {
          street: "12 Rivonia Road",
          city: "Sandton",
          postalCode: "2196",
          region: "Gauteng",
          country: "ZA",
          formatted: "12 Rivonia Road, Sandton, 2196, Gauteng",
          type: "Default / Billing",
          status: "EXISTING",
          statusState: "Success"
        }
      };
      oAppState.setProperty("/customer", oCustomer);
      oAppState.setProperty("/marketing/marketToYou", "YES");
      oAppState.setProperty("/marketing/marketingLanguage", "English");
      oAppState.setProperty("/marketing/marketingCorrespondenceMethod", "EMAIL");
      oAppState.setProperty("/marketing/statementCorrespondenceMethod", "EMAIL");
      oAppState.setProperty("/marketing/creditBureauCheck", "YES");
      oAppState.setProperty("/orderHeader/orderType", "ZOR");
      oAppState.setProperty("/orderHeader/orderTypeName", "Delivery Order");

      var oAddrObj = {
        street: "12 Rivonia Road",
        city: "Sandton",
        postalCode: "2196",
        region: "Gauteng",
        country: "South Africa",
        formatted: "12 Rivonia Road, Sandton, 2196, Gauteng",
        status: "VALIDATED",
        statusState: "Success",
        validated: true
      };
      oAppState.setProperty("/delivery/deliveryAddress", oAddrObj);
      oAppState.setProperty("/delivery/shipToAddress/street", "12 Rivonia Road");
      oAppState.setProperty("/delivery/shipToAddress/city", "Sandton");
      oAppState.setProperty("/delivery/shipToAddress/postalCode", "2196");
      oAppState.setProperty("/delivery/shipToAddress/state", "Gauteng");
      oAppState.setProperty("/delivery/shipToAddress/formatted", "12 Rivonia Road, Sandton, 2196, Gauteng");
      oAppState.setProperty("/review/shippingDetails/address", "12 Rivonia Road, Sandton, 2196, Gauteng");
      oAppState.setProperty("/delivery/methodKey", "CND");
      oAppState.setProperty("/delivery/methodTitle", "Delivery (CND)");
      oAppState.setProperty("/delivery/methodSubtitle", "Deliver to customer address");

      if (oWizardModel) {
        oWizardModel.setProperty("/customerSelected", true);
        oWizardModel.setProperty("/addressValidated", true);
      }

      // 2. Preload products covering ALL decision table rows
      var aDemoProducts = [
        {
          articleId: "ART-CND-01",
          name: "Samsung 65\" QLED 4K Smart TV",
          sourcingIdentifier: "[M · Full Stock]",
          sourcingCode: "CND_FULL",
          articleStatus: "M",
          site: "M001",
          price: 14999.00,
          qty: 1,
          availableQty: 25,
          stock: 25,
          itemCat: "TAN",
          baseDC: "QL30",
          oaaSource: "DC M001 (Centurion DC)",
          shippingPoint: "SP-01",
          sourcingRuleDescription: "Reserve requested quantity at OAA source."
        },
        {
          articleId: "ART-CND-02",
          name: "Bosch Series 6 Front Loader 9kg",
          sourcingIdentifier: "[M · F001 No Stock → Base DC QL30]",
          sourcingCode: "CND_F001_M",
          articleStatus: "M",
          site: "M001",
          price: 8999.00,
          qty: 1,
          availableQty: 0,
          stock: 0,
          itemCat: "TAN",
          baseDC: "QL30",
          oaaSource: "Customer Base DC (QL30)",
          shippingPoint: "SP-QL30",
          sourcingRuleDescription: "Do not reserve line. Assign to Base DC QL30 and allow order to proceed."
        },
        {
          articleId: "ART-CND-03",
          name: "Smeg 50s Retro 2-Slice Toaster",
          sourcingIdentifier: "[Not M · F001 No Stock → Blocked]",
          sourcingCode: "CND_F001_NOT_M",
          articleStatus: "Not M",
          site: "M001",
          price: 2499.00,
          qty: 1,
          availableQty: 0,
          stock: 0,
          itemCat: "TAN",
          baseDC: "-",
          oaaSource: "None",
          shippingPoint: "-",
          sourcingRuleDescription: "Require user to remove it, then run sourcing again."
        },
        {
          articleId: "ART-CND-04",
          name: "LG 635L Side-by-Side Inverter Refrigerator",
          sourcingIdentifier: "[M · F002 Partial Stock → Split Base DC]",
          sourcingCode: "CND_F002_M",
          articleStatus: "M",
          site: "M001",
          price: 19999.00,
          qty: 3,
          availableQty: 2,
          stock: 2,
          itemCat: "TAN",
          baseDC: "QL30",
          oaaSource: "DC M001 (Centurion DC)",
          shippingPoint: "SP-01",
          sourcingRuleDescription: "Reserve available (2 EA), route remainder (1 EA) to Base DC QL30 as additional line."
        },
        {
          articleId: "ART-CND-05",
          name: "Philips Hue Gradient Ambience Lightstrip",
          sourcingIdentifier: "[Not M · F002 Partial Stock → Must Remove]",
          sourcingCode: "CND_F002_NOT_M",
          articleStatus: "Not M",
          site: "M001",
          price: 1899.00,
          qty: 3,
          availableQty: 1,
          stock: 1,
          itemCat: "TAN",
          baseDC: "-",
          oaaSource: "DC M001",
          shippingPoint: "SP-01",
          sourcingRuleDescription: "V3.3 Rule: Remove line item from cart, then run sourcing again."
        },
        {
          articleId: "ART-CNC-06",
          name: "DeLonghi Magnifica S Coffee Maker",
          sourcingIdentifier: "[Eligible · CNC Full Stock]",
          sourcingCode: "CNC_FULL",
          articleStatus: "M",
          site: "S101",
          price: 7499.00,
          qty: 1,
          availableQty: 12,
          stock: 12,
          itemCat: "TAN",
          baseDC: "QL30",
          oaaSource: "Store S101 (Centurion)",
          shippingPoint: "Store Pickup",
          sourcingRuleDescription: "Show stores with full quantity available. Reserve stock there."
        },
        {
          articleId: "ART-CNC-07",
          name: "Weber Master-Touch 57cm Charcoal Braai",
          sourcingIdentifier: "[CNC · F002 Partial Stock → Prompt Reduce Qty]",
          sourcingCode: "CNC_PARTIAL",
          articleStatus: "M",
          site: "S101",
          price: 4299.00,
          qty: 3,
          availableQty: 1,
          stock: 1,
          itemCat: "TAN",
          baseDC: "QL30",
          oaaSource: "Store S101",
          shippingPoint: "Store Pickup",
          sourcingRuleDescription: "Ask user to reduce quantity to available amount (1 EA); reserve that quantity."
        },
        {
          articleId: "ART-CNP-08",
          name: "JBL PartyBox Stage 320 Bluetooth Speaker",
          sourcingIdentifier: "[Eligible · CNP Full Stock]",
          sourcingCode: "CNP_FULL",
          articleStatus: "M",
          site: "P001",
          price: 6999.00,
          qty: 1,
          availableQty: 16,
          stock: 16,
          itemCat: "TAN",
          baseDC: "QL30",
          oaaSource: "BOPIS Hub (Centurion Mall)",
          shippingPoint: "Hub Pickup",
          sourcingRuleDescription: "Show pickup points with stock available. Reserve stock there."
        },
        {
          articleId: "ART-CNP-09",
          name: "Sony WH-1000XM5 Wireless ANC Headphones",
          sourcingIdentifier: "[CNP · F002 Partial Stock → Prompt Reduce Qty]",
          sourcingCode: "CNP_PARTIAL",
          articleStatus: "Not M",
          site: "P001",
          price: 5999.00,
          qty: 2,
          availableQty: 1,
          stock: 1,
          itemCat: "TAN",
          baseDC: "-",
          oaaSource: "BOPIS Hub (Centurion Mall)",
          shippingPoint: "Hub Pickup",
          sourcingRuleDescription: "Ask user to reduce quantity (to 1 EA); reserve available amount."
        },
        {
          articleId: "ART-ERR-10",
          name: "Makita 18V Cordless Rotary Hammer Drill",
          sourcingIdentifier: "[CNC/CNP · No Eligible Location → Must Remove]",
          sourcingCode: "NO_LOCATION",
          articleStatus: "M",
          site: "S101",
          price: 3299.00,
          qty: 1,
          availableQty: 0,
          stock: 0,
          itemCat: "TAN",
          baseDC: "QL30",
          oaaSource: "None returned",
          shippingPoint: "None",
          sourcingRuleDescription: "Identify item causing sourcing issue. User removes it, then app calls wrapper again."
        },
        {
          articleId: "ART-NLAG-11",
          name: "White Glove Appliance Installation & Tech Support",
          sourcingIdentifier: "[NLAG · Excluded from OAA]",
          sourcingCode: "NLAG",
          articleStatus: "NLAG",
          site: "M001",
          price: 650.00,
          qty: 1,
          availableQty: 999,
          stock: 999,
          itemCat: "NLAG",
          baseDC: "-",
          oaaSource: "Direct Fulfillment",
          shippingPoint: "None",
          sourcingRuleDescription: "Exclude NLAG items from OAA request. Directly confirmed without stock reservation."
        }
      ];

      var aCart = aDemoProducts.map(function (prod, idx) {
        var nItemNo = (idx + 1) * 10;
        return {
          item: String(nItemNo),
          articleId: prod.articleId,
          targetQty: prod.qty,
          qty: prod.qty,
          um: "EA",
          description: prod.name,
          name: prod.name,
          productNo: "PRD-" + prod.articleId,
          valueAdds: "-",
          pricePerUnit: prod.price,
          netPrice: prod.price,
          itemPrice: +(prod.qty * prod.price).toFixed(2),
          netValue: +(prod.qty * prod.price).toFixed(2),
          salesPersonId: "SP-1042",
          site: prod.site,
          itemCat: prod.itemCat,
          extendedGuarantee: "-",
          rejReason: "-",
          discountPct: 0,
          hasCondition: false,
          conditionText: "",
          isSubItem: false,
          articleStatus: prod.articleStatus,
          sourcingIdentifier: prod.sourcingIdentifier,
          sourcingCode: prod.sourcingCode,
          availableQty: prod.availableQty,
          stock: prod.stock,
          baseDC: prod.baseDC,
          oaaSource: prod.oaaSource,
          shippingPoint: prod.shippingPoint,
          sourcingRuleDescription: prod.sourcingRuleDescription
        };
      });

      oAppState.setProperty("/cart", aCart);
      oAppState.setProperty("/cartCount", aCart.length);
      this.recalculateTotals();

      // Validate steps
      var oStepCustomer = this.byId("stepCustomer");
      var oStepConsent = this.byId("stepConsent");
      var oStepProducts = this.byId("stepProducts");
      var oStepDeliveryMethod = this.byId("stepDeliveryMethod");
      var oWizard = this.byId("salesOrderWizard");

      if (oStepCustomer) oStepCustomer.setValidated(true);
      if (oStepConsent) oStepConsent.setValidated(true);
      if (oStepProducts) oStepProducts.setValidated(true);

      if (oWizard) {
        if (oStepCustomer) oWizard.validateStep(oStepCustomer);
        if (oStepConsent) oWizard.validateStep(oStepConsent);
        if (oStepProducts) oWizard.validateStep(oStepProducts);
        if (oStepDeliveryMethod) {
          oWizard.goToStep(oStepDeliveryMethod, true);
        }
      }

      this.updateCartSourcingEvaluation();
      MessageToast.show("Loaded all 11 Decision Table sourcing test cases on Delivery Method screen!");
    },

    onSelectDeliveryMethodToCustomer: function () {
      this.onSelectDeliveryCND();
    },

    onSelectInStoreCollection: function () {
      this.onSelectClickAndCollectCNC();
    },

    onSelectWarehousePickup: function () {
      this.onSelectBopisCNP();
    },

    // ========================================================
    // STEP 6: REVIEW SHIPPING
    // ========================================================

    onPayeeSelectChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (oItem) {
        var sKey = oItem.getKey();
        var sText = oItem.getText();
        var oAppState = this.getModel("appState");
        oAppState.setProperty("/delivery/payee", sKey);
        oAppState.setProperty("/delivery/payeeText", sText);
        oAppState.setProperty("/review/shippingDetails/payee", sText);
      }
    },

    onShipToSelectChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (!oItem) {
        return;
      }
      var sKey = oItem.getKey();
      var sText = oItem.getText();
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/shipTo", sKey);
      oAppState.setProperty("/delivery/shipToName", sText);
      oAppState.setProperty("/review/shippingDetails/shipTo", sText);

      var mAddresses = {
        "1000234571": {
          street: "12 Rivonia Road",
          city: "Sandton",
          state: "Gauteng",
          postalCode: "2196",
          country: "South Africa",
          phone: "+27 82 555 0192"
        },
        "1000234588": {
          street: "88 Sandton Drive",
          city: "Sandton",
          state: "Gauteng",
          postalCode: "2196",
          country: "South Africa",
          phone: "+27 11 884 9000"
        },
        "1000234599": {
          street: "50 Oxford Road",
          city: "Rosebank",
          state: "Gauteng",
          postalCode: "2196",
          country: "South Africa",
          phone: "+27 11 788 4321"
        }
      };

      if (mAddresses[sKey]) {
        oAppState.setProperty("/delivery/shipToAddress", mAddresses[sKey]);
        oAppState.setProperty("/review/shippingDetails/phoneNumber", mAddresses[sKey].phone);
      }
      MessageToast.show("Ship to updated: " + sText);
    },

    onBillToSelectChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (!oItem) {
        return;
      }
      var sKey = oItem.getKey();
      var sText = oItem.getText();
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/billTo", sKey);
      oAppState.setProperty("/delivery/billToName", sText);
      oAppState.setProperty("/review/billingDetails/billTo", sText);
      MessageToast.show("Bill to updated: " + sText);
    },

    onRequestedDeliveryDateChange: function (oEvent) {
      var sValue = oEvent.getParameter("value");
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/requestedDeliveryDate", sValue);
      oAppState.setProperty("/review/shippingDetails/requestedDeliveryDate", sValue);
      MessageToast.show("Requested delivery date: " + sValue);
    },

    onSingleShipmentChange: function (oEvent) {
      var bState = oEvent.getParameter("state");
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/singleShipment", bState);
      oAppState.setProperty("/review/shippingDetails/singleShipment", bState ? "Yes" : "No");
      MessageToast.show("Single shipment: " + (bState ? "Yes" : "No"));
    },

    onCarrierChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (oItem) {
        var sText = oItem.getText();
        var oAppState = this.getModel("appState");
        oAppState.setProperty("/delivery/carrier", sText);
        oAppState.setProperty("/review/shippingDetails/carrier", sText);
        MessageToast.show("Carrier selected: " + sText);
      }
    },

    onShippingMethodChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (oItem) {
        var sText = oItem.getText();
        var oAppState = this.getModel("appState");
        oAppState.setProperty("/delivery/shipping", sText);
        oAppState.setProperty("/review/shippingDetails/shipping", sText);
        MessageToast.show("Shipping method: " + sText);
      }
    },

    onIncotermsChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (oItem) {
        var sText = oItem.getText();
        var oAppState = this.getModel("appState");
        oAppState.setProperty("/delivery/incoterms", sText);
        oAppState.setProperty("/review/shippingDetails/incoterms", sText);
        MessageToast.show("Incoterms: " + sText);
      }
    },

    onFileSizeExceed: function (oEvent) {
      MessageBox.error("File size cannot exceed 2 MB. Please choose a smaller file.", {
        title: "File Size Limit Exceeded"
      });
      var oUploader = oEvent.getSource();
      if (oUploader && typeof oUploader.clear === "function") {
        oUploader.clear();
      }
    },

    onFileSelected: function (oEvent) {
      var oUploader = oEvent.getSource();
      var aFiles = oEvent.getParameter("files");
      var oFile = (aFiles && aFiles.length > 0)
        ? aFiles[0]
        : (oUploader.getDomRef && oUploader.getDomRef("fu") && oUploader.getDomRef("fu").files ? oUploader.getDomRef("fu").files[0] : null);

      if (!oFile) {
        return;
      }

      // 2MB size restriction (2 * 1024 * 1024 bytes)
      var MAX_SIZE = 2 * 1024 * 1024;
      if (oFile.size > MAX_SIZE) {
        var nSizeMb = (oFile.size / (1024 * 1024)).toFixed(2);
        MessageBox.error("File size exceeds 2MB limit. The selected file is " + nSizeMb + " MB.", {
          title: "File Size Limit Exceeded"
        });
        if (oUploader && typeof oUploader.clear === "function") {
          oUploader.clear();
        }
        return;
      }

      var that = this;
      var oReader = new FileReader();
      oReader.onload = function (e) {
        var sDataUrl = e.target.result;
        var sFileName = oFile.name;
        var isPdf = sFileName.toLowerCase().endsWith(".pdf") || oFile.type === "application/pdf";
        var sSizeFormatted = oFile.size >= 1024 * 1024
          ? (oFile.size / (1024 * 1024)).toFixed(1) + " MB"
          : (oFile.size / 1024).toFixed(1) + " KB";

        var sBase64Data = "";
        if (typeof sDataUrl === "string" && sDataUrl.indexOf(",") !== -1) {
          sBase64Data = sDataUrl.split(",")[1];
        } else {
          sBase64Data = sDataUrl || "";
        }

        var sFileType = oFile.type || "";
        if (!sFileType && sFileName.indexOf(".") !== -1) {
          sFileType = sFileName.split(".").pop().toUpperCase();
        }
        if (sFileType.length > 20) {
          sFileType = sFileType.substring(0, 20);
        }

        var dNow = new Date();
        var sFormattedDate = (dNow.getMonth() + 1) + "/" + dNow.getDate() + "/" + dNow.getFullYear();

        var oNewAttachment = {
          AttaId: sFileName,
          Descr: sFileName,
          FileData: sBase64Data,
          id: sFileName,
          fileName: sFileName,
          name: sFileName,
          fileSize: sSizeFormatted,
          size: sSizeFormatted,
          fileType: sFileType,
          uploadDate: sFormattedDate,
          isPdf: isPdf,
          url: sDataUrl
        };

        that._addAttachmentLocally(oNewAttachment);
        MessageToast.show("Attachment added: " + sFileName);

        if (oUploader && typeof oUploader.clear === "function") {
          oUploader.clear();
        }
      };

      oReader.readAsDataURL(oFile);
    },

    _addAttachmentLocally: function (oNewAttachment) {
      var oAppState = this.getModel("appState");
      if (oAppState) {
        var aAttachments = oAppState.getProperty("/delivery/attachments") || [];
        var bExists = aAttachments.some(function (att) {
          return (att.fileName === oNewAttachment.fileName) || (att.AttaId === oNewAttachment.AttaId) || (att.name === oNewAttachment.name);
        });
        if (!bExists) {
          aAttachments.push(oNewAttachment);
          oAppState.setProperty("/delivery/attachments", aAttachments);
          oAppState.setProperty("/attachments", aAttachments);
          oAppState.refresh(true);
        } else {
          MessageToast.show("File with same name already attached.");
        }
      }
    },

    onAttachmentPress: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("appState") || oSource.getBindingContext("soc_cart") || oSource.getBindingContext();
      var oAttachment = oContext ? oContext.getObject() : null;
      if (!oAttachment) {
        return;
      }

      var sFileName = oAttachment.Descr || oAttachment.fileName || oAttachment.name || oAttachment.AttaId || "attachment";
      var isPdf = oAttachment.isPdf || sFileName.toLowerCase().endsWith(".pdf") || oAttachment.fileType === "application/pdf";

      var sUrl = oAttachment.url;
      if (!sUrl && oAttachment.FileData) {
        if (oAttachment.FileData.startsWith("data:")) {
          sUrl = oAttachment.FileData;
        } else {
          var mime = isPdf ? "application/pdf" : "application/octet-stream";
          sUrl = "data:" + mime + ";base64," + oAttachment.FileData;
        }
      }

      if (isPdf) {
        if (sUrl) {
          if (sUrl.startsWith("data:")) {
            try {
              var parts = sUrl.split(',');
              var mimeMatch = parts[0].match(/:(.*?);/);
              var mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
              var byteCharacters = atob(parts[1]);
              var byteNumbers = new Array(byteCharacters.length);
              for (var i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              var byteArray = new Uint8Array(byteNumbers);
              var blob = new Blob([byteArray], { type: mimeType });
              var blobUrl = URL.createObjectURL(blob);
              var win = window.open(blobUrl, "_blank");
              if (!win) {
                var a = document.createElement("a");
                a.href = blobUrl;
                a.target = "_blank";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            } catch (err) {
              window.open(sUrl, "_blank");
            }
          } else {
            window.open(sUrl, "_blank");
          }
        } else {
          MessageToast.show("Attachment content is not available.");
        }
      } else {
        if (sUrl) {
          var downloadLink = document.createElement("a");
          downloadLink.href = sUrl;
          downloadLink.download = sFileName;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          MessageToast.show("Downloading " + sFileName);
        } else {
          MessageToast.show("Attachment content is not available.");
        }
      }
    },

    onDeleteAttachment: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("appState") || oSource.getBindingContext("soc_cart") || oSource.getBindingContext();
      if (!oContext) {
        var oListItem = oEvent.getParameter && oEvent.getParameter("listItem");
        if (oListItem) {
          oContext = oListItem.getBindingContext("appState") || oListItem.getBindingContext("soc_cart") || oListItem.getBindingContext();
        }
      }
      if (!oContext) {
        return;
      }
      var sPath = oContext.getPath();
      var iIndex = parseInt(sPath.split("/").pop(), 10);
      var oAppState = this.getModel("appState");
      var oAttachment = oContext.getObject();
      var sName = oAttachment ? (oAttachment.fileName || oAttachment.name || oAttachment.Descr || "attachment") : "attachment";

      MessageBox.confirm("Are you sure you want to remove '" + sName + "'?", {
        title: "Remove Attachment",
        actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
        emphasizedAction: MessageBox.Action.DELETE,
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.DELETE) {
            var aAttachments = oAppState.getProperty("/delivery/attachments") || [];
            aAttachments.splice(iIndex, 1);
            oAppState.setProperty("/delivery/attachments", aAttachments);
            oAppState.setProperty("/attachments", aAttachments);
            oAppState.refresh(true);
            MessageToast.show("Attachment removed");
          }
        }
      });
    },

    onAttachmentFileChange: function (oEvent) {
      this.onFileSelected(oEvent);
    },

    onTriggerAddAttachment: function () {
      MessageToast.show("Choose a file using Browse to attach.");
    },

    onToggleSameAsBilling: function (oEvent) {
      var bState = oEvent.getParameter("state");
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/sameAsBilling", bState);

      if (!bState) {
        this.onChangeDifferentAddress();
      } else {
        MessageToast.show("Reusing validated billing address (no second plug-in call)");
      }
      this._updatePendingActionText();
    },

    onChangeDifferentAddress: function () {
      var that = this;
      var oAppState = this.getModel("appState");

      this.openAddressValidationDialog("Ship-To", function (oSelectedAddress) {
        if (oSelectedAddress) {
          var oDiff = {
            street: oSelectedAddress.street,
            city: oSelectedAddress.city,
            postalCode: oSelectedAddress.postalCode,
            region: oSelectedAddress.region,
            formatted: oSelectedAddress.formatted,
            status: oSelectedAddress.status || "MODIFIED",
            statusState: that.formatter.addressStatusState(oSelectedAddress.status),
            note: oSelectedAddress.note || "Selected for ship-to delivery"
          };
          oAppState.setProperty("/delivery/differentAddress", oDiff);
          that._updatePendingActionText();
          MessageToast.show("Ship-to address updated (" + oDiff.status + ")");
        }
      });
    },

    _updatePendingActionText: function () {
      var oAppState = this.getModel("appState");
      var bSame = oAppState.getProperty("/delivery/sameAsBilling");
      var sStatus = bSame
        ? oAppState.getProperty("/customer/address/status")
        : oAppState.getProperty("/delivery/differentAddress/status");

      var sPendingAction = "";
      if (sStatus === "NEW") {
        sPendingAction = "On Create: Create SD Customer and Address (OData) → Create Sales Order";
      } else if (sStatus === "MODIFIED") {
        sPendingAction = "On Create: Update SD Customer Address (OData) → Create Sales Order";
      } else {
        sPendingAction = "On Create: None – Create Sales Order directly";
      }
      oAppState.setProperty("/pendingActionText", sPendingAction);
    },

    // ========================================================
    // STEP 7: REVIEW & ORDER CREATION (Screen 15 & 16)
    // ========================================================
    onWizardComplete: function () {
      this.onCreateSalesOrder();
    },

    onReviewShipmentPriorityChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      var sKey = oItem ? oItem.getKey() : "";
      var oSelect = this.byId("selReviewShipmentPriority");

      if (sKey) {
        if (oSelect) {
          oSelect.setValueState("None");
        }
        var sText = sKey === "01" ? "01 – Immediate" : (sKey === "02" ? "02 – High" : (sKey === "03" ? "03 – Standard" : "04 – Low"));
        this.getModel("appState").setProperty("/orderFinal/shipmentPriority", sKey);
        this.getModel("appState").setProperty("/orderFinal/shipmentPriorityText", sText);
      } else {
        this.getModel("appState").setProperty("/orderFinal/shipmentPriority", "");
        this.getModel("appState").setProperty("/orderFinal/shipmentPriorityText", "");
        if (oSelect) {
          oSelect.setValueState("Error");
          oSelect.setValueStateText("Shipment Priority is mandatory.");
        }
      }
    },

    onCreateSalesOrder: function () {
      var oAppState = this.getModel("appState");
      var sPriority = (oAppState.getProperty("/orderFinal/shipmentPriority") || "").trim();

      // Mandatory validation: trigger error message if priority is not set
      if (!sPriority) {
        var oSelect = this.byId("selReviewShipmentPriority");
        if (oSelect) {
          oSelect.setValueState("Error");
          oSelect.setValueStateText("Shipment Priority is mandatory. Please select a shipment priority.");
        }
        MessageBox.error("Shipment Priority is mandatory. Please select a shipment priority in Shipping Details before creating the sales order.", {
          title: "Validation Error"
        });
        return;
      }

      var sSalesOrderNo = "50000" + Math.floor(10000 + Math.random() * 90000);
      var sShipToBp = oAppState.getProperty("/customer/bpNumber") || "1000234588";
      var sPriorityText = sPriority === "01" ? "01 – Immediate" : (sPriority === "02" ? "02 – High" : (sPriority === "03" ? "03 – Standard" : "04 – Low"));

      oAppState.setProperty("/orderFinal/salesOrderNo", sSalesOrderNo);
      oAppState.setProperty("/orderFinal/shipToBp", sShipToBp);
      oAppState.setProperty("/orderFinal/shipmentPriorityText", sPriorityText);
      oAppState.setProperty("/orderFinal/isSaved", true);

      // Assemble complete sales order record for list report & object detail page
      var oCustomer = oAppState.getProperty("/customer") || {};
      var oOrderHeader = oAppState.getProperty("/orderHeader") || {};
      var oDelivery = oAppState.getProperty("/delivery") || {};
      var oPricing = oAppState.getProperty("/pricing") || { netValue: 0, discounts: 0, vat: 0, total: 0 };
      var aCart = oAppState.getProperty("/cart") || [];
      var oReview = oAppState.getProperty("/review") || {};

      var sCustomerName = oCustomer.name || (oCustomer.firstName ? (oCustomer.firstName + " " + (oCustomer.lastName || "")) : (oCustomer.companyName || "Thabo Mokoena"));
      var sCustomerBp = oCustomer.bpNumber || sShipToBp || "1000234588";
      var sOrderIdNumber = oCustomer.idPassport || (oCustomer.regNo || "8804125089085");
      var sCustomerPhone = oCustomer.telephone || (oDelivery.shipToAddress && oDelivery.shipToAddress.phone) || "+27 82 555 0192";
      var sCustomerEmail = oCustomer.email || "customer@example.com";

      var sDeliveryAddress = "";
      if (oDelivery.methodKey === "CND") {
        sDeliveryAddress = (oDelivery.address && oDelivery.address.formatted) || (oCustomer.address && oCustomer.address.formatted) || "12 Rivonia Road, Sandton, 2196, Gauteng";
      } else if (oDelivery.methodKey === "CNC") {
        sDeliveryAddress = (oDelivery.collectionStore && (oDelivery.collectionStore.storeName + ", " + oDelivery.collectionStore.address)) || "Centurion Lifestyle Centre, Shop 18, Lenchen Ave, Centurion";
      } else {
        sDeliveryAddress = (oDelivery.bopisAddress && oDelivery.bopisAddress.address) || "Sandton City Store, Shop L38, Sandton";
      }

      var dNow = new Date();
      var aMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      var sToday = dNow.getDate() + " " + aMonths[dNow.getMonth()] + " " + dNow.getFullYear();

      var aOrderItems = aCart.map(function (c, idx) {
        var nItemPrice = Number(c.netPrice || c.price || 0);
        var nItemQty = Number(c.qty || 1);
        return {
          item: String((idx + 1) * 10),
          articleId: c.articleId || c.id || ("ART-00" + (idx + 1)),
          name: c.name || c.description || ("Line Item " + (idx + 1)),
          description: c.description || c.name || ("Line Item " + (idx + 1)),
          category: c.category || "General Merchandise",
          qty: nItemQty,
          netPrice: nItemPrice,
          netValue: Number(c.netValue || (nItemQty * nItemPrice)),
          routingTarget: c.routingTarget || c.sourcingStatusText || "Standard DC Route",
          sourcingStatusText: c.sourcingStatusText || "Stock Allocated"
        };
      });

      if (aOrderItems.length === 0) {
        aOrderItems.push({
          item: "10",
          articleId: "ART-CND-01",
          name: "Standard Merchandise Article",
          description: "Standard Store Item",
          category: "General",
          qty: 1,
          netPrice: Number(oPricing.netValue || 1499.00),
          netValue: Number(oPricing.netValue || 1499.00),
          routingTarget: "Base DC Route",
          sourcingStatusText: "Allocated"
        });
      }

      var oNewOrderRecord = {
        salesOrderNo: sSalesOrderNo,
        orderDate: sToday,
        status: "Created",
        statusState: "Success",
        customerName: sCustomerName,
        customerBp: sCustomerBp,
        customerIdNumber: sOrderIdNumber,
        customerMobile: sCustomerPhone,
        customerEmail: sCustomerEmail,
        soldToParty: sCustomerBp + " - " + sCustomerName,
        shipToParty: sCustomerBp + " - " + sCustomerName,
        orderType: oOrderHeader.orderType || "ZOR",
        orderTypeName: oOrderHeader.orderTypeName || "Standard Store Order",
        orderTypeDesc: (oOrderHeader.orderType || "ZOR") + " · " + (oOrderHeader.orderTypeName || "Standard Store Order"),
        tvLicenseType: oOrderHeader.tvLicenseType || "Existing License",
        poNumber: "PO-" + sSalesOrderNo,
        salesOrg: (oCustomer.salesOrg || "1000") + " - Retail South Africa",
        paymentTerms: oOrderHeader.paymentTerms || "Immediate",
        deliveryMethod: oDelivery.methodKey || "CND",
        deliveryMethodTitle: oDelivery.methodTitle || "Click & Deliver (CND)",
        deliveryType: oDelivery.methodKey === "CND" ? "Delivery" : "Pick",
        deliveryAddress: sDeliveryAddress,
        supplyingSite: oDelivery.methodKey === "CND" ? "DC M001 (Centurion DC)" : ((oDelivery.collectionStore && oDelivery.collectionStore.storeName) || "Centurion Store S101"),
        shippingPoint: oDelivery.methodKey === "CND" ? "SP-01" : "SP-STORE",
        carrier: (oDelivery.carrier || (oReview.shippingDetails && oReview.shippingDetails.carrier)) || "DHL Express",
        incoterms: (oDelivery.incoterms || (oReview.shippingDetails && oReview.shippingDetails.incoterms)) || "FOB - Free on Board",
        requestedDeliveryDate: oDelivery.requestedDeliveryDate || (oReview.shippingDetails && oReview.shippingDetails.requestedDeliveryDate) || "28 Oct 2026",
        shipmentPriority: sPriority,
        shipmentPriorityText: sPriorityText,
        currency: "ZAR",
        pricing: {
          netValue: Number(oPricing.netValue || 0),
          discounts: Number(oPricing.discounts || 0),
          vat: Number(oPricing.vat || 0),
          total: Number(oPricing.total || 0)
        },
        totalAmount: Number(oPricing.total || 0),
        items: aOrderItems,
        attachments: JSON.parse(JSON.stringify((oDelivery && oDelivery.attachments && oDelivery.attachments.length > 0) ? oDelivery.attachments : (oAppState.getProperty("/delivery/attachments") || []))),
        posTransaction: "POS-TRX-" + sSalesOrderNo,
        deliveryBlock: "NONE",
        financial: {
          totalPriceInclTax: Number(oPricing.total || 0),
          requestedDownpayment: Number(oPricing.total || 0),
          receivedDownpayment: Number(oPricing.total || 0)
        }
      };

      // Persist to salesOrders model and localStorage
      var oSalesOrdersModel = this.getOwnerComponent().getModel("salesOrders");
      if (oSalesOrdersModel) {
        var aExistingOrders = oSalesOrdersModel.getProperty("/orders") || [];
        aExistingOrders.unshift(oNewOrderRecord);
        oSalesOrdersModel.setProperty("/orders", aExistingOrders);
        oSalesOrdersModel.setProperty("/filteredOrders", aExistingOrders);
        try {
          localStorage.setItem("sap_sales_orders_store", JSON.stringify(aExistingOrders));
        } catch (e) {}
      }

      var that = this;
      MessageBox.success("Sales Order " + sSalesOrderNo + " created successfully.", {
        title: "Sales Order Created",
        actions: [MessageBox.Action.OK],
        emphasizedAction: MessageBox.Action.OK,
        onClose: function () {
          that.onCreateNewOrderReset();
          that.getRouter().navTo("salesOrderList");
        }
      });
    },

    onNavToSalesOrderList: function () {
      this.getRouter().navTo("salesOrderList");
    },

    onCreateNewOrderReset: function () {
      var oNewAppState = models.createAppStateModel();
      this.getOwnerComponent().setModel(oNewAppState, "appState");
      this.getView().setModel(oNewAppState, "appState");

      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/orderCreated", false);
      oWizardModel.setProperty("/showNewCustomerCapture", false);
      oWizardModel.setProperty("/isCreatingNewCustomer", false);
      oWizardModel.setProperty("/customerSelected", false);
      oWizardModel.setProperty("/addressValidated", false);
      oWizardModel.setProperty("/isNewlyCreatedCustomer", false);
      oWizardModel.setProperty("/searchPanelExpanded", true);
      oWizardModel.setProperty("/newCustomerTypeIndex", 0);
      oWizardModel.setProperty("/searchCriteria", {
        customerName: "",
        mobile: "",
        email: "",
        customerNumber: "",
        idNumber: "",
        orderOrAccountNo: "",
        dealNumber: "",
        plusMoreNumber: ""
      });
      oWizardModel.setProperty("/productSearchQuery", "");

      var oWizard = this.byId("salesOrderWizard");
      if (oWizard) {
        var oStep1 = this.byId("stepCustomer");
        if (oStep1) {
          oStep1.setValidated(false);
          oWizard.discardProgress(oStep1);
          oWizard.goToStep(oStep1, true);
        }
        var oStepConsent = this.byId("stepConsent");
        if (oStepConsent) {
          oStepConsent.setValidated(false);
        }
        var oStepProducts = this.byId("stepProducts");
        if (oStepProducts) {
          oStepProducts.setValidated(false);
        }
      }

      var oSelectPriority = this.byId("selReviewShipmentPriority");
      if (oSelectPriority) {
        oSelectPriority.setSelectedKey("");
        oSelectPriority.setValueState("None");
      }

      this.recalculateTotals();
      this._updatePendingActionText();
    }
  });
});
