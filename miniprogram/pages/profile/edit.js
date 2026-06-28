const { profile } = require('../../data/mock')
const { getElderProfile, saveElderProfile } = require('../../utils/storage')
const { getCloudElderProfile, createOrUpdateElderProfile } = require('../../services/elderService')

function buildForm(value) {
  return {
    phone: value.phone || '',
    medicalHistory: value.medicalHistory || '',
    painAreas: value.painAreas || '',
    emergencyContact: value.emergencyContact || '',
    height: value.height || '',
    weight: value.weight || '',
    note: value.note || ''
  }
}

Page({
  data: {
    baseProfile: profile,
    form: buildForm(profile),
    saving: false
  },

  onShow() {
    const localProfile = getElderProfile(profile)
    this.setData({
      baseProfile: localProfile,
      form: buildForm(localProfile)
    })
    this.loadCloudProfile()
  },

  async loadCloudProfile() {
    const cloudProfile = await getCloudElderProfile(profile)
    this.setData({
      baseProfile: cloudProfile,
      form: buildForm(cloudProfile)
    })
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: event.detail.value
    })
  },

  async saveProfile() {
    if (this.data.saving) {
      return
    }

    const nextProfile = {
      ...this.data.baseProfile,
      ...this.data.form
    }

    this.setData({ saving: true })

    try {
      const saved = await createOrUpdateElderProfile(nextProfile)
      saveElderProfile(saved)
      wx.showToast({
        title: '资料已保存',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 500)
    } catch (error) {
      console.warn('完善资料云端保存失败，已保留本地资料', error)
      saveElderProfile(nextProfile)
      wx.showToast({
        title: '已保存到本机',
        icon: 'none'
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
