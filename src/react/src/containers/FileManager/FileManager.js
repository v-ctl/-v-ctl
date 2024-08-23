import React, { Component } from 'react';
import DirectoryList from '../../components/Lists/DirectoryList/DirectoryList';
import ProgressBar from '../../components/ProgressBar/ProgressBar';
import { toast, ToastContainer } from 'react-toastify';
import Hotkeys from '../../components/Hotkeys/Hotkeys';
import Modal from '../../components/Modal/Modal';
import 'react-toastify/dist/ReactToastify.css';
import { withRouter } from 'react-router-dom';
import Menu from '../../components/Menu/Menu';
import * as FM from '../../FileManagerHelper';
import axios from 'axios';
import { Helmet } from 'react-helmet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import 'src/containers/App/App.scss';
import { connect } from 'react-redux';

const server = window.location.origin + "/file_manager/fm_api.php?";
class FileManager extends Component {
  constructor(props) {
    super(props);
    this.state = {
      leftList: {
        path: '',
        files: { listing: [] },
      },
      rightList: {
        path: '',
        files: { listing: [] },
      },
      currentPath: '',
      currentUser: '',
      activeWindow: "left",
      modalWindow: null,
      modalVisible: false,
      cursor: 0,
      itemName: "",
      itemPermissions: "",
      itemType: "",
      itemsSelected: [],
      modalInputValue: "",
      uploadPercent: "0",
      loading: false
    }
  }

  UNSAFE_componentWillMount = () => {
    if (!this.props.session.userName) return this.props.history.push('/login');

    FM.cacheData(this.state.currentUser, this.props.history, this.props.menuCounters.user.HOME);
    let currentPath = FM.activeWindowPath();
    this.setState({
      currentPath,
      currentUser: this.props.menuCounters.user.HOME,
      leftList: { ...this.state.leftList, path: this.props.menuCounters.user.HOME },
      rightList: { ...this.state.rightList, path: this.props.menuCounters.user.HOME }
    });
    this.changeDirectoryOnLoading();
  }

  componentDidMount = () => {
    window.addEventListener("keydown", this.switchActiveList);
    window.addEventListener("keydown", this.toggleActiveListOnTab);
    document.addEventListener("keydown", this.hotkeysListener);

    if (localStorage.getItem('activeWindow')) {
      this.setState({ activeWindow: localStorage.getItem('activeWindow') });
    }
  }

  componentWillUnmount = () => {
    window.removeEventListener("keydown", this.switchActiveList);
    window.removeEventListener("keydown", this.toggleActiveListOnTab);
    document.removeEventListener("keydown", this.hotkeysListener);
  }

  cachePaths = () => {
    localStorage.setItem('activeWindow', this.state.activeWindow);
    localStorage.setItem('leftListPath', this.state.leftList.path);
    localStorage.setItem('rightListPath', this.state.rightList.path);
  }

  setStateAsync = updater => new Promise(resolve => this.setState(updater, resolve));

  changeDirectoryOnLoading = async () => {
    ['leftList', 'rightList'].map(async (side) => {
      const result = await FM.changeDirectoryOnLoading(server, `${side}Path`);
      let path = localStorage.getItem(`${side}Path`);
      let listing = result.data.listing;
      await this.setStateAsync({ [side]: { files: { listing }, path } });
    });

    await this.setStateAsync({ loading: false });
  }

  changeDirectory = () => {
    const { leftList, rightList } = this.state;
    Promise.all([FM.changeDirectory(server, leftList.path), FM.changeDirectory(server, rightList.path)])
      .then(result => {
        const [leftListResponse, rightListResponse] = result;
        let leftListing = leftListResponse.data.listing;
        let rightListing = rightListResponse.data.listing;

        this.setState({ leftList: { ...leftList, files: { listing: leftListing } }, rightList: { ...rightList, files: { listing: rightListing } }, loading: false });

        this.leftList.resetData();
        this.rightList.resetData();
      });
  }

  toggleActiveListOnTab = (e) => {
    const { activeWindow, rightList, leftList, currentPath } = this.state;

    if (this.state.modalVisible) {
      return;
    }

    if (e.keyCode === 9) {
      e.preventDefault();
      if (activeWindow === "left") {
        this.setState({ activeWindow: "right", currentPath: rightList.path });
        this.rightList.passData();
      } else {
        this.setState({ activeWindow: "left", currentPath: leftList.path });
        this.leftList.passData();
      }
      this.changeQuery(currentPath);
      this.cachePaths();
    }
  }

  passSelection = (itemsSelected) => {
    this.setState({ itemsSelected });
  }

  toggleActiveList = (list) => {
    this.setState({ activeWindow: list });
  }

  switchActiveList = (e) => {
    if (this.state.modalVisible) {
      return;
    }

    if (e.keyCode === 39) {
      this.setState({ activeWindow: "right", currentPath: this.state.rightList.path });
      this.changeQuery(this.state.currentPath);
      this.rightList.passData();
      this.cachePaths();
    } else if (e.keyCode === 37) {
      this.setState({ activeWindow: "left", currentPath: this.state.leftList.path });
      this.changeQuery(this.state.currentPath);
      this.leftList.passData();
      this.cachePaths();
    }
  }

  validateAction = async (url) => {
    await this.setStateAsync({ loading: true });
    let response = await FM.validateAction(url);
    if (response.data.result) {
      this.changeDirectory();
    } else {
      this.showError(response.data.message);
    }
  }

  showError = (error) => {
    toast.error(error, {
      position: "top-center",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true
    });
    this.setState({ loading: false });
  }

  download = () => {
    const { cursor, currentPath, itemName } = this.state;

    if (cursor !== 0) {
      window.open('/api/v1/download/file/?path=' + currentPath + '/' + itemName);
    }
  }

  checkExistingFileName = (selectedFiles) => {
    const { activeWindow, leftList, rightList } = this.state;
    const { existingFileNames, newFiles } = FM.checkExistingFileName(selectedFiles, activeWindow, leftList.files.listing, rightList.files.listing);

    if (existingFileNames.length !== 0) {
      this.modal("Replace", existingFileNames);
      this.upload(newFiles);
    } else {
      this.upload(selectedFiles);
    }
  }

  replaceFiles = (selectedFiles) => {
    for (let i = 0; i < selectedFiles.length; i++) {
      this.validateAction(`${server}item=${FM.encodePath(this.state.currentPath)}%2F${selectedFiles[i].name}&dir=${FM.encodePath(this.state.currentPath)}&action=delete_files`);
    }

    this.upload(selectedFiles);
  }

  upload = (selectedFiles) => {
    const formData = new FormData();

    if (selectedFiles.length === 0) {
      return;
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files[]', selectedFiles[i], selectedFiles[i].name);
    }

    this.setState({ loading: true }, () => {
      axios.post(`${window.location.origin}/api/v1/upload/?dir=${this.state.currentPath}`, formData, {
        onUploadProgress: progressEvent => {
          let uploadPercent = Math.round(progressEvent.loaded / progressEvent.total * 100);
          this.setState({ uploadPercent });
        }
      }).then(() => {
        this.setState({ uploadPercent: "0" });
        this.changeDirectory();
      })
    });
  }

  onDelete = async () => {
    const { itemsSelected, itemName, currentPath } = this.state;
    if (itemsSelected.length > 0) {
      await this.setStateAsync({ loading: true });
      await FM.deleteItems(server, FM.encodePath(currentPath), itemsSelected);
      await this.setStateAsync({ itemsSelected: [] });
      this.changeDirectory();
    } else {
      this.validateAction(`${server}item=${FM.encodePath(currentPath)}%2F${itemName}&dir=${FM.encodePath(currentPath)}&action=delete_files`);
    }
  }

  newFile = () => {
    let name = this.inputElement.value;
    this.validateAction(`${server}filename=${name}&dir=${FM.encodePath(this.state.currentPath)}&action=create_file`);
  }

  newDir = () => {
    let name = this.inputElement.value;
    this.validateAction(`${server}dirname=${name}&dir=${FM.encodePath(this.state.currentPath)}&action=create_dir`);
  }

  onRename = () => {
    const { modalInputValue, itemType, itemName, currentPath } = this.state;
    let name = modalInputValue;
    if (itemType === "f") {
      this.validateAction(`${server}item=${itemName}&target_name=${name}&dir=${FM.encodePath(currentPath)}&action=rename_file`);
    } else if (itemType === "d") {
      this.validateAction(`${server}item=${itemName}&target_name=${name}&dir=${FM.encodePath(currentPath)}%2F&action=rename_directory`);
    }
  }

  onChangePermissions = () => {
    let permissions = this.state.modalInputValue;
    this.validateAction(`${server}dir=${FM.encodePath(this.state.currentPath)}%2F&item=${this.state.itemName}&permissions=${permissions}&action=chmod_item`);
    this.setState({ itemPermissions: permissions });
  }

  archiveItem = () => {
    let name = this.inputElement.value;

    if (this.state.itemsSelected.length > 0) {
      this.setState({ loading: true }, () => {
        let items = [];
        for (let i = 0; i < this.state.itemsSelected.length; i++) {
          let path = `${this.state.currentPath}/`;
          items.push(path += this.state.itemsSelected[i]);
        }
        this.validateAction(`${server}items=${items}&dst_item=${FM.encodePath(name)}&action=pack_item`);
        this.setState({ itemsSelected: [] });
      })
    } else {
      this.validateAction(`${server}items=${FM.encodePath(this.state.currentPath)}%2F${this.state.itemName}&dst_item=${FM.encodePath(name)}&action=pack_item`);
    }
  }

  extractItem = () => {
    let name = this.inputElement.value;
    this.validateAction(`${server}item=${FM.encodePath(this.state.currentPath)}%2F${this.state.itemName}&filename=${this.state.itemName}&dir=${FM.encodePath(this.state.currentPath)}&dir_target=${name}&action=unpack_item`);
  }

  moveItem = async () => {
    const { currentPath, itemsSelected, itemName } = this.state;
    let targetDir = this.inputElement.value;

    if (itemsSelected.length > 0) {
      await this.setStateAsync({ loading: true });
      await FM.moveItems(server, FM.encodePath(currentPath), targetDir, itemsSelected);
      await this.setStateAsync({ itemsSelected: [] });
      this.changeDirectory();
    } else {
      this.validateAction(`${server}item=${currentPath}%2F${itemName}&target_name=${targetDir}&action=move_file`);
    }
  }

  copyItem = async () => {
    const { currentPath, itemsSelected, itemName } = this.state;
    let targetDir = this.inputElement.value;

    if (itemsSelected.length > 0) {
      await this.setStateAsync({ loading: true });
      await FM.copyItems(server, FM.encodePath(currentPath), targetDir, itemsSelected);
      await this.setStateAsync({ itemsSelected: [] });
      this.changeDirectory();
    } else {
      this.validateAction(`${server}item=${currentPath}%2F${itemName}&filename=${itemName}&dir=${currentPath}&dir_target=${targetDir}&action=copy_file`);
    }
  }

  changeQuery = (path) => {
    this.props.history.push({
      pathname: '/list/directory/',
      search: `?path=${path}`
    });
  }

  openDirectory = () => {
    this.setState({ loading: true }, () => {
      this.changeDirectory();
      this.cachePaths();
    });
  }

  openCertainDirectory = () => {
    this.setState({ loading: true }, () => {
      this.changeDirectory();
      this.cachePaths();
    });
  }

  moveBack = () => {
    const { activeWindow } = this.state;

    let list = { ...this.state[`${activeWindow}List`] };
    list.path = list.path.substring(0, list.path.lastIndexOf('/'));
    this.setState({ [`${activeWindow}List`]: list, currentPath: list.path });
    this.props.history.push({ search: `?path=${list.path}` })
    this.openDirectory();
  }

  addToPath = (name) => {
    const { activeWindow } = this.state;

    let activeList = { ...this.state[`${activeWindow}List`] };
    let oldPath = activeList.path;
    activeList.path = `${oldPath}/${name}`;
    this.setState({ [`${activeWindow}List`]: activeList, currentPath: activeList.path });
  }

  changeInputValue = (modalInputValue) => {
    this.setState({ modalInputValue });
  }

  changePathAfterToggle = (currentPath) => {
    this.setState({ currentPath });
  }

  changePath = (currentPath) => {
    if (this.state.activeWindow === "left") {
      this.setState({ leftList: { files: { ...this.state.leftList.files }, path: currentPath }, currentPath });
    } else {
      this.setState({ rightList: { files: { ...this.state.rightList.files }, path: currentPath }, currentPath });
    }
  }

  passData = (cursor, itemName, itemPermissions, itemType) => {
    this.setState({ cursor, itemName, itemPermissions, itemType });
  }

  closeModal = () => {
    this.setState({ modalVisible: false });
  }

  hotkeysListener = (e) => {
    if (this.state.modalVisible) {
      return;
    }

    if (e.keyCode === 72) {
      this.hotkeys();
    }
  }

  hotkeys = () => {
    if (this.state.hotkeysPanel === "inactive") {
      this.setState({ hotkeysPanel: "active" });
    } else {
      this.setState({ hotkeysPanel: "inactive" });
    }
  }

  modal = (type, items, available) => {
    const { modalVisible, itemName, itemPermissions, currentPath } = this.state;
    switch (type) {
      case 'Copy': return this.setState({ modalWindow: <Modal modalVisible={modalVisible} type={type} fName={itemName} path={currentPath} onClick={this.copyItem} items={items} onClose={this.closeModal} onChangeValue={this.changeInputValue} reference={(inp) => this.inputElement = inp} />, modalVisible: true });
      case 'Move': return this.setState({ modalWindow: <Modal modalVisible={modalVisible} type={type} fName={itemName} path={currentPath} onClick={this.moveItem} items={items} onClose={this.closeModal} onChangeValue={this.changeInputValue} reference={(inp) => this.inputElement = inp} />, modalVisible: true });
      case 'Extract': return this.setState({ modalWindow: <Modal modalVisible={modalVisible} type={type} fName={itemName} onClick={this.extractItem} onClose={this.closeModal} onChangeValue={this.changeInputValue} path={currentPath} reference={(inp) => this.inputElement = inp} />, modalVisible: true });
      case 'Archive': return this.setState({ modalWindow: <Modal modalVisible={modalVisible} type={type} fName={itemName} onClick={this.archiveItem} items={items} onClose={this.closeModal} onChangeValue={this.changeInputValue} path={currentPath} reference={(inp) => this.inputElement = inp} />, modalVisible: true });
      case 'Permissions': return this.setState({ modalWindow: <Modal modalVisible={modalVisible} type={type} fName={itemName} onClick={this.onChangePermissions} onClose={this.closeModal} onChangePermissions={this.changeInputValue} permissions={itemPermissions} />, modalVisible: true });
      case 'Rename': return this.setState({ modalWindow: <Modal modalVisible={modalVisible} type={type} fName={itemName} onChangeValue={this.changeInputValue} onClick={this.onRename} onClose={this.closeModal} reference={(inp) => this.inputElement = inp} />, modalVisible: true });
      case 'Add directory': return this.setState({ modalWindow: <Modal modalVisible={modalVisible} type={type} onClick={this.newDir} onClose={this.closeModal} reference={(inp) => this.inputElement = inp} />, modalVisible: true });
      case 'Add file': return this.setState({ modalWindow: <Modal modalVisible={modalVisible} type={type} onClick={this.newFile} onClose={this.closeModal} reference={(inp) => this.inputElement = inp} />, modalVisible: true });
      case 'Delete': return this.setState({ modalWindow: <Modal modalVisible={modalVisible} type={type} fName={itemName} onClick={this.onDelete} onClose={this.closeModal} items={items} />, modalVisible: true });
      case 'Nothing selected': return this.setState({ modalWindow: <Modal modalVisible={modalVisible} notAvailable={available} type={type} onClose={this.closeModal} onClick={this.closeModal} />, modalVisible: true });
      case "Replace": return this.setState({ modalWindow: <Modal modalVisible={modalVisible} type={type} files={items} onClick={(files) => this.replaceFiles(files)} onClose={this.closeModal} />, modalVisible: true });
      default:
        break;
    }
  }

  render() {
    const { activeWindow, modalWindow, modalVisible, itemsSelected, itemName, loading, uploadPercent, itemType } = this.state;
    return (
      <div className="window">
        <Helmet>
          <title>{this.props.session.i18n['File Manager']}</title>
        </Helmet>
        {uploadPercent !== "0" && <ProgressBar progress={uploadPercent} />}
        <ToastContainer />
        <Menu
          onDelete={this.onDeleteFileHandler}
          modalVisible={modalVisible}
          download={this.download}
          openModal={this.modal}
          selection={itemsSelected}
          itemType={itemType}
          upload={this.checkExistingFileName}
          cursor={this.state.cursor}
          name={itemName} />
        <div className="lists-container">
          {this.props.session.userName && ['left', 'right'].map((side) =>
            <DirectoryList
              changePathAfterToggle={this.changePathAfterToggle}
              openCertainDirectory={this.openCertainDirectory}
              isActive={activeWindow === side}
              openDirectory={this.openDirectory}
              passSelection={this.passSelection}
              data={this.state[`${side}List`].files}
              onClick={this.toggleActiveList}
              changePath={this.changePath}
              modalVisible={modalVisible}
              addToPath={this.addToPath}
              cursor={this.state.cursor}
              passData={this.passData}
              rootDir={this.props.menuCounters.user.HOME}
              ref={el => this[`${side}List`] = el}
              download={this.download}
              moveBack={this.moveBack}
              path={this.state[`${side}List`].path}
              history={this.props.history}
              loading={loading}
              list={side} />
          )}
          <div className="fixed-buttons fm">
            <div className="hotkey-button">
              <button onClick={() => this.hotkeysList.classList.toggle('hide')}>
                <FontAwesomeIcon icon="ellipsis-h" />
              </button>
            </div>
          </div>
          <Hotkeys reference={(inp) => this.hotkeysList = inp} toggleHotkeys={() => this.hotkeysList.classList.toggle('hide')} />
        </div>
        {modalVisible && modalWindow}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    session: state.session,
    menuCounters: state.menuCounters
  }
}

export default connect(mapStateToProps)(withRouter(FileManager));
